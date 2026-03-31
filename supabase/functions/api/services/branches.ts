/**
 * Production-ready branches service
 * Handles business logic for branch operations
 */

import { BranchesRepository } from '../repositories/branches.js';
import { Branch, GeoLocation } from '../types/index.js';
import { NotFoundError, ConflictError, ValidationError } from '../middleware/error.js';

export class BranchesService {
  private branchesRepository: BranchesRepository;

  constructor(branchesRepository: BranchesRepository) {
    this.branchesRepository = branchesRepository;
  }

  /**
   * Get branch by ID with business logic
   */
  async getBranchById(id: string): Promise<Branch> {
    if (!id || id.trim() === '') {
      throw new ValidationError('Branch ID is required');
    }

    return await this.branchesRepository.getBranchById(id);
  }

  /**
   * Get all branches with optional filtering
   */
  async getAllBranches(filters: {
    regionId?: string;
    districtId?: string;
    isActive?: boolean;
  } = {}): Promise<Branch[]> {
    // Validate filters
    if (filters.regionId && !this.isValidId(filters.regionId)) {
      throw new ValidationError('Invalid region ID format');
    }

    if (filters.districtId && !this.isValidId(filters.districtId)) {
      throw new ValidationError('Invalid district ID format');
    }

    return await this.branchesRepository.getAllBranches(filters);
  }

  /**
   * Get paginated branches
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
    // Validate pagination parameters
    if (page < 1) {
      throw new ValidationError('Page must be greater than 0');
    }

    if (limit < 1 || limit > 100) {
      throw new ValidationError('Limit must be between 1 and 100');
    }

    return await this.branchesRepository.getBranchesPaginated(page, limit, filters);
  }

  /**
   * Create new branch with business validation
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
    // Validate required fields
    this.validateBranchData(branchData);

    // Validate phone number format
    if (!this.isValidPhone(branchData.phone)) {
      throw new ValidationError('Invalid phone number format');
    }

    // Validate coordinates
    if (!this.isValidCoordinates(branchData.coordinates)) {
      throw new ValidationError('Invalid coordinates');
    }

    // Validate login format
    if (!this.isValidLogin(branchData.login)) {
      throw new ValidationError('Login must be alphanumeric and 3-50 characters long');
    }

    return await this.branchesRepository.createBranch(branchData);
  }

  /**
   * Update branch with business validation
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
    if (!id || id.trim() === '') {
      throw new ValidationError('Branch ID is required');
    }

    // Validate update data
    if (updateData.phone && !this.isValidPhone(updateData.phone)) {
      throw new ValidationError('Invalid phone number format');
    }

    if (updateData.coordinates && !this.isValidCoordinates(updateData.coordinates)) {
      throw new ValidationError('Invalid coordinates');
    }

    if (updateData.login && !this.isValidLogin(updateData.login)) {
      throw new ValidationError('Login must be alphanumeric and 3-50 characters long');
    }

    if (updateData.regionId && !this.isValidId(updateData.regionId)) {
      throw new ValidationError('Invalid region ID format');
    }

    if (updateData.districtId && !this.isValidId(updateData.districtId)) {
      throw new ValidationError('Invalid district ID format');
    }

    return await this.branchesRepository.updateBranch(id, updateData);
  }

  /**
   * Delete branch with business validation
   */
  async deleteBranch(id: string): Promise<void> {
    if (!id || id.trim() === '') {
      throw new ValidationError('Branch ID is required');
    }

    // TODO: Check if branch has active orders or dependencies
    // For now, just proceed with deletion
    await this.branchesRepository.deleteBranch(id);
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
    if (!searchTerm || searchTerm.trim() === '') {
      throw new ValidationError('Search term is required');
    }

    if (searchTerm.length < 2) {
      throw new ValidationError('Search term must be at least 2 characters long');
    }

    // Validate filters
    if (filters.regionId && !this.isValidId(filters.regionId)) {
      throw new ValidationError('Invalid region ID format');
    }

    if (filters.districtId && !this.isValidId(filters.districtId)) {
      throw new ValidationError('Invalid district ID format');
    }

    return await this.branchesRepository.searchBranches(searchTerm, filters);
  }

  /**
   * Get branches within radius of a point
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
    // Validate coordinates
    if (!this.isValidCoordinates(center)) {
      throw new ValidationError('Invalid center coordinates');
    }

    // Validate radius
    if (radiusKm < 0 || radiusKm > 1000) {
      throw new ValidationError('Radius must be between 0 and 1000 kilometers');
    }

    return await this.branchesRepository.getBranchesWithinRadius(center, radiusKm, filters);
  }

  /**
   * Get nearest branches to a point
   */
  async getNearestBranches(
    center: GeoLocation,
    limit: number = 5,
    filters: {
      regionId?: string;
      districtId?: string;
      isActive?: boolean;
    } = {}
  ): Promise<Branch[]> {
    // Validate coordinates
    if (!this.isValidCoordinates(center)) {
      throw new ValidationError('Invalid center coordinates');
    }

    // Validate limit
    if (limit < 1 || limit > 50) {
      throw new ValidationError('Limit must be between 1 and 50');
    }

    // Get branches within a reasonable radius (50km)
    const branches = await this.branchesRepository.getBranchesWithinRadius(
      center, 
      50, 
      filters
    );

    // Return the nearest branches up to the limit
    return branches.slice(0, limit);
  }

  /**
   * Validate branch data
   */
  private validateBranchData(branchData: {
    name: string;
    branchName: string;
    login: string;
    regionId: string;
    districtId: string;
    phone: string;
    managerName: string;
    coordinates: GeoLocation;
    managerId?: string;
  }): void {
    if (!branchData.name || branchData.name.trim() === '') {
      throw new ValidationError('Branch name is required');
    }

    if (branchData.name.length > 100) {
      throw new ValidationError('Branch name must not exceed 100 characters');
    }

    if (!branchData.branchName || branchData.branchName.trim() === '') {
      throw new ValidationError('Branch display name is required');
    }

    if (branchData.branchName.length > 100) {
      throw new ValidationError('Branch display name must not exceed 100 characters');
    }

    if (!branchData.login || branchData.login.trim() === '') {
      throw new ValidationError('Branch login is required');
    }

    if (!branchData.regionId || branchData.regionId.trim() === '') {
      throw new ValidationError('Region ID is required');
    }

    if (!branchData.districtId || branchData.districtId.trim() === '') {
      throw new ValidationError('District ID is required');
    }

    if (!branchData.phone || branchData.phone.trim() === '') {
      throw new ValidationError('Phone number is required');
    }

    if (!branchData.managerName || branchData.managerName.trim() === '') {
      throw new ValidationError('Manager name is required');
    }

    if (branchData.managerName.length > 100) {
      throw new ValidationError('Manager name must not exceed 100 characters');
    }

    if (!branchData.coordinates) {
      throw new ValidationError('Coordinates are required');
    }
  }

  /**
   * Validate phone number format
   */
  private isValidPhone(phone: string): boolean {
    // Basic international phone format validation
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }

  /**
   * Validate coordinates
   */
  private isValidCoordinates(coordinates: GeoLocation): boolean {
    return (
      coordinates &&
      typeof coordinates.lat === 'number' &&
      typeof coordinates.lng === 'number' &&
      coordinates.lat >= -90 &&
      coordinates.lat <= 90 &&
      coordinates.lng >= -180 &&
      coordinates.lng <= 180
    );
  }

  /**
   * Validate login format
   */
  private isValidLogin(login: string): boolean {
    // Alphanumeric with underscores and hyphens, 3-50 characters
    const loginRegex = /^[a-zA-Z0-9_-]{3,50}$/;
    return loginRegex.test(login);
  }

  /**
   * Validate ID format (UUID or string ID)
   */
  private isValidId(id: string): boolean {
    // Allow UUID format or simple string IDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const stringIdRegex = /^[a-zA-Z0-9_-]{1,50}$/;
    return uuidRegex.test(id) || stringIdRegex.test(id);
  }
}
