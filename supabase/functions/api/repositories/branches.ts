/**
 * Production-ready branches repository
 * Handles all branch-related database operations
 */

import { BaseRepository } from './base.js';
import { Branch, GeoLocation } from '../types/index.js';
import { NotFoundError, ConflictError } from '../middleware/error.js';

export class BranchesRepository extends BaseRepository {
  /**
   * Get branch by ID
   */
  async getBranchById(id: string): Promise<Branch> {
    const branch = await this.findById<any>('branches', id);
    
    if (!branch) {
      throw new NotFoundError(`Branch with ID ${id} not found`);
    }

    return this.mapToBranch(branch);
  }

  /**
   * Get all branches
   */
  async getAllBranches(filters: {
    regionId?: string;
    districtId?: string;
    isActive?: boolean;
  } = {}): Promise<Branch[]> {
    const branches = await this.findMany<any>('branches', filters);
    return branches.map(branch => this.mapToBranch(branch));
  }

  /**
   * Get branches with pagination
   */
  async getBranchesPaginated(
    page: number = 1,
    limit: number = 20,
    filters: {
      regionId?: string;
      districtId?: string;
      isActive?: boolean;
    } = {}
  ): Promise<{
    data: Branch[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const result = await this.findWithPagination<any>('branches', page, limit, filters);
    
    return {
      ...result,
      data: result.data.map(branch => this.mapToBranch(branch))
    };
  }

  /**
   * Create new branch
   */
  async createBranch(branchData: {
    name: string;
    branchName: string;
    login: string;
    regionId: string;
    districtId: string;
    phone: string;
    managerName: string;
    coordinates: GeoLocation;
    managerId?: string;
  }): Promise<Branch> {
    // Check if login already exists
    const existingBranch = await this.findMany<any>('branches', { login: branchData.login });
    if (existingBranch.length > 0) {
      throw new ConflictError('Branch login already exists');
    }

    const newBranch = await this.create<any>('branches', {
      ...branchData,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    return this.mapToBranch(newBranch);
  }

  /**
   * Update branch
   */
  async updateBranch(
    id: string,
    updateData: Partial<{
      name: string;
      branchName: string;
      login: string;
      regionId: string;
      districtId: string;
      phone: string;
      managerName: string;
      coordinates: GeoLocation;
      managerId: string;
      isActive: boolean;
    }>
  ): Promise<Branch> {
    // Check if branch exists
    await this.getBranchById(id);

    // If updating login, check for conflicts
    if (updateData.login) {
      const existingBranches = await this.findMany<any>('branches', { 
        login: updateData.login 
      });
      const conflictingBranch = existingBranches.find(branch => branch.id !== id);
      
      if (conflictingBranch) {
        throw new ConflictError('Branch login already exists');
      }
    }

    const updatedBranch = await this.update<any>('branches', id, updateData);
    return this.mapToBranch(updatedBranch);
  }

  /**
   * Delete branch
   */
  async deleteBranch(id: string): Promise<void> {
    // Check if branch exists
    await this.getBranchById(id);

    // TODO: Check for dependent records (orders, users, etc.)
    // For now, just delete the branch
    await this.delete('branches', id);
  }

  /**
   * Search branches
   */
  async searchBranches(
    searchTerm: string,
    filters: {
      regionId?: string;
      districtId?: string;
      isActive?: boolean;
    } = {}
  ): Promise<Branch[]> {
    const branches = await this.search<any>(
      'branches',
      searchTerm,
      ['name', 'branch_name', 'manager_name', 'phone'],
      filters
    );
    
    return branches.map(branch => this.mapToBranch(branch));
  }

  /**
   * Get branches by coordinates within radius
   */
  async getBranchesWithinRadius(
    center: GeoLocation,
    radiusKm: number,
    filters: {
      regionId?: string;
      districtId?: string;
      isActive?: boolean;
    } = {}
  ): Promise<Branch[]> {
    // Using PostGIS for geospatial query
    const sql = `
      SELECT *, 
             ST_Distance(
               coordinates::geography, 
               ST_MakePoint($1, $2)::geography
             ) as distance_meters
      FROM branches 
      WHERE ST_DWithin(
        coordinates::geography, 
        ST_MakePoint($1, $2)::geography, 
        $3
      )
      ${filters.regionId ? 'AND region_id = $4' : ''}
      ${filters.districtId ? `AND district_id = $${filters.regionId ? '5' : '4'}` : ''}
      ${filters.isActive !== undefined ? `AND is_active = $${filters.regionId ? (filters.districtId ? '6' : '5') : (filters.districtId ? '5' : '4')}` : ''}
      ORDER BY distance_meters
    `;

    const params: any[] = [center.lng, center.lat, radiusKm * 1000]; // Convert to meters
    let paramIndex = 4;

    if (filters.regionId) {
      params.push(filters.regionId);
      paramIndex++;
    }

    if (filters.districtId) {
      params.push(filters.districtId);
      paramIndex++;
    }

    if (filters.isActive !== undefined) {
      params.push(filters.isActive);
    }

    try {
      const branches = await this.executeRaw<any>(sql, params);
      return branches.map(branch => this.mapToBranch(branch));
    } catch (error) {
      // Fallback to simple distance calculation if PostGIS is not available
      console.warn('PostGIS not available, falling back to simple distance calculation');
      return this.getBranchesWithinRadiusFallback(center, radiusKm, filters);
    }
  }

  /**
   * Fallback method for distance calculation without PostGIS
   */
  private async getBranchesWithinRadiusFallback(
    center: GeoLocation,
    radiusKm: number,
    filters: {
      regionId?: string;
      districtId?: string;
      isActive?: boolean;
    } = {}
  ): Promise<Branch[]> {
    const branches = await this.getAllBranches(filters);
    
    return branches.filter(branch => {
      const distance = this.calculateDistance(center, branch.coordinates);
      return distance <= radiusKm;
    });
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(coord1: GeoLocation, coord2: GeoLocation): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(coord2.lat - coord1.lat);
    const dLon = this.toRadians(coord2.lng - coord1.lng);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(coord1.lat)) * Math.cos(this.toRadians(coord2.lat)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Map database record to Branch entity
   */
  private mapToBranch(record: any): Branch {
    return {
      id: record.id,
      name: record.name,
      branchName: record.branch_name,
      login: record.login,
      regionId: record.region_id,
      districtId: record.district_id,
      phone: record.phone,
      managerName: record.manager_name,
      coordinates: {
        lat: record.coordinates?.lat || record.coordinates?.y || 0,
        lng: record.coordinates?.lng || record.coordinates?.x || 0
      },
      isActive: record.is_active ?? true,
      managerId: record.manager_id,
      createdAt: record.created_at,
      updatedAt: record.updated_at
    };
  }
}
