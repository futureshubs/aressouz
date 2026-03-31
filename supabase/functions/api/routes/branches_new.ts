/**
 * Production-ready branches routes
 * Handles HTTP requests for branch operations
 */

import { Hono } from 'hono';
import { BranchesService } from '../services/branches.js';
import { BranchesRepository } from '../repositories/branches.js';
import { ValidationMiddleware, CommonValidationRules } from '../middleware/validation.js';
import { rbac } from '../middleware/auth.js';
import { ValidationError } from '../middleware/error.js';

export function createBranchesRoutes(supabaseUrl: string, supabaseServiceKey: string): Hono {
  const app = new Hono();
  
  // Initialize dependencies
  const branchesRepository = new BranchesRepository(supabaseUrl, supabaseServiceKey);
  const branchesService = new BranchesService(branchesRepository);

  /**
   * GET /branches - Get all branches with optional filtering
   */
  app.get(
    '/branches',
    ValidationMiddleware.validateQuery([
      CommonValidationRules.pagination.page,
      CommonValidationRules.pagination.limit,
      {
        field: 'regionId',
        required: false,
        type: 'string'
      },
      {
        field: 'districtId',
        required: false,
        type: 'string'
      },
      {
        field: 'isActive',
        required: false,
        type: 'boolean'
      },
      {
        field: 'search',
        required: false,
        type: 'string',
        minLength: 2,
        maxLength: 100
      },
      {
        field: 'lat',
        required: false,
        type: 'number',
        min: -90,
        max: 90
      },
      {
        field: 'lng',
        required: false,
        type: 'number',
        min: -180,
        max: 180
      },
      {
        field: 'radius',
        required: false,
        type: 'number',
        min: 0.1,
        max: 1000
      }
    ]),
    async (c) => {
      const query = c.get('validatedQuery') as any;
      const {
        page = 1,
        limit = 20,
        regionId,
        districtId,
        isActive,
        search,
        lat,
        lng,
        radius
      } = query;

      try {
        let result: any;

        // Handle search
        if (search) {
          result = await branchesService.searchBranches(search, {
            regionId,
            districtId,
            isActive: isActive !== undefined ? isActive : undefined
          });
        }
        // Handle geospatial search
        else if (lat && lng) {
          const center = { lat: parseFloat(lat), lng: parseFloat(lng) };
          const radiusKm = radius ? parseFloat(radius) : 10; // Default 10km
          
          result = await branchesService.getBranchesWithinRadius(center, radiusKm, {
            regionId,
            districtId,
            isActive: isActive !== undefined ? isActive : undefined
          });
        }
        // Handle paginated results
        else {
          result = await branchesService.getBranchesPaginated(
            parseInt(page),
            parseInt(limit),
            {
              regionId,
              districtId,
              isActive: isActive !== undefined ? isActive : undefined
            }
          );
        }

        return c.json({
          success: true,
          data: Array.isArray(result) ? result : result.data,
          pagination: result.total ? {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: result.totalPages,
            hasNext: result.page < result.totalPages,
            hasPrev: result.page > 1
          } : undefined,
          timestamp: new Date().toISOString(),
          requestId: c.get('requestId')
        });

      } catch (error) {
        if (error instanceof ValidationError) {
          throw error;
        }
        
        console.error('Error in GET /branches:', error);
        throw error;
      }
    }
  );

  /**
   * GET /branches/:id - Get branch by ID
   */
  app.get(
    '/branches/:id',
    ValidationMiddleware.validateParams([
      CommonValidationRules.uuid
    ]),
    async (c) => {
      const { id } = c.get('validatedParams') as any;

      try {
        const branch = await branchesService.getBranchById(id);

        return c.json({
          success: true,
          data: branch,
          timestamp: new Date().toISOString(),
          requestId: c.get('requestId')
        });

      } catch (error) {
        console.error(`Error in GET /branches/${id}:`, error);
        throw error;
      }
    }
  );

  /**
   * POST /branches - Create new branch (Admin/Management only)
   */
  app.post(
    '/branches',
    rbac.management(),
    ValidationMiddleware.validateBody([
      {
        field: 'name',
        required: true,
        type: 'string',
        minLength: 1,
        maxLength: 100
      },
      {
        field: 'branchName',
        required: true,
        type: 'string',
        minLength: 1,
        maxLength: 100
      },
      {
        field: 'login',
        required: true,
        type: 'string',
        minLength: 3,
        maxLength: 50,
        pattern: /^[a-zA-Z0-9_-]+$/
      },
      {
        field: 'regionId',
        required: true,
        type: 'string'
      },
      {
        field: 'districtId',
        required: true,
        type: 'string'
      },
      {
        field: 'phone',
        required: true,
        type: 'string',
        pattern: /^\+?[1-9]\d{1,14}$/
      },
      {
        field: 'managerName',
        required: true,
        type: 'string',
        minLength: 1,
        maxLength: 100
      },
      {
        field: 'coordinates',
        required: true,
        type: 'object'
      },
      {
        field: 'coordinates.lat',
        required: true,
        type: 'number',
        min: -90,
        max: 90
      },
      {
        field: 'coordinates.lng',
        required: true,
        type: 'number',
        min: -180,
        max: 180
      },
      {
        field: 'managerId',
        required: false,
        type: 'string'
      }
    ]),
    async (c) => {
      const body = c.get('validatedBody') as any;

      try {
        const branch = await branchesService.createBranch(body);

        return c.json({
          success: true,
          data: branch,
          message: 'Branch created successfully',
          timestamp: new Date().toISOString(),
          requestId: c.get('requestId')
        });

      } catch (error) {
        console.error('Error in POST /branches:', error);
        throw error;
      }
    }
  );

  /**
   * PUT /branches/:id - Update branch (Admin/Management only)
   */
  app.put(
    '/branches/:id',
    rbac.management(),
    ValidationMiddleware.validateParams([
      CommonValidationRules.uuid
    ]),
    ValidationMiddleware.validateBody([
      {
        field: 'name',
        required: false,
        type: 'string',
        minLength: 1,
        maxLength: 100
      },
      {
        field: 'branchName',
        required: false,
        type: 'string',
        minLength: 1,
        maxLength: 100
      },
      {
        field: 'login',
        required: false,
        type: 'string',
        minLength: 3,
        maxLength: 50,
        pattern: /^[a-zA-Z0-9_-]+$/
      },
      {
        field: 'regionId',
        required: false,
        type: 'string'
      },
      {
        field: 'districtId',
        required: false,
        type: 'string'
      },
      {
        field: 'phone',
        required: false,
        type: 'string',
        pattern: /^\+?[1-9]\d{1,14}$/
      },
      {
        field: 'managerName',
        required: false,
        type: 'string',
        minLength: 1,
        maxLength: 100
      },
      {
        field: 'coordinates',
        required: false,
        type: 'object'
      },
      {
        field: 'coordinates.lat',
        required: false,
        type: 'number',
        min: -90,
        max: 90
      },
      {
        field: 'coordinates.lng',
        required: false,
        type: 'number',
        min: -180,
        max: 180
      },
      {
        field: 'managerId',
        required: false,
        type: 'string'
      },
      {
        field: 'isActive',
        required: false,
        type: 'boolean'
      }
    ]),
    async (c) => {
      const { id } = c.get('validatedParams') as any;
      const body = c.get('validatedBody') as any;

      try {
        const branch = await branchesService.updateBranch(id, body);

        return c.json({
          success: true,
          data: branch,
          message: 'Branch updated successfully',
          timestamp: new Date().toISOString(),
          requestId: c.get('requestId')
        });

      } catch (error) {
        console.error(`Error in PUT /branches/${id}:`, error);
        throw error;
      }
    }
  );

  /**
   * DELETE /branches/:id - Delete branch (Admin only)
   */
  app.delete(
    '/branches/:id',
    rbac.admin(),
    ValidationMiddleware.validateParams([
      CommonValidationRules.uuid
    ]),
    async (c) => {
      const { id } = c.get('validatedParams') as any;

      try {
        await branchesService.deleteBranch(id);

        return c.json({
          success: true,
          message: 'Branch deleted successfully',
          timestamp: new Date().toISOString(),
          requestId: c.get('requestId')
        });

      } catch (error) {
        console.error(`Error in DELETE /branches/${id}:`, error);
        throw error;
      }
    }
  );

  /**
   * GET /branches/nearest - Get nearest branches to coordinates
   */
  app.get(
    '/branches/nearest',
    ValidationMiddleware.validateQuery([
      {
        field: 'lat',
        required: true,
        type: 'number',
        min: -90,
        max: 90
      },
      {
        field: 'lng',
        required: true,
        type: 'number',
        min: -180,
        max: 180
      },
      {
        field: 'limit',
        required: false,
        type: 'number',
        min: 1,
        max: 50
      },
      {
        field: 'regionId',
        required: false,
        type: 'string'
      },
      {
        field: 'districtId',
        required: false,
        type: 'string'
      },
      {
        field: 'isActive',
        required: false,
        type: 'boolean'
      }
    ]),
    async (c) => {
      const query = c.get('validatedQuery') as any;
      const {
        lat,
        lng,
        limit = 5,
        regionId,
        districtId,
        isActive
      } = query;

      try {
        const center = { 
          lat: parseFloat(lat), 
          lng: parseFloat(lng) 
        };

        const branches = await branchesService.getNearestBranches(center, parseInt(limit), {
          regionId,
          districtId,
          isActive: isActive !== undefined ? isActive : undefined
        });

        return c.json({
          success: true,
          data: branches,
          timestamp: new Date().toISOString(),
          requestId: c.get('requestId')
        });

      } catch (error) {
        console.error('Error in GET /branches/nearest:', error);
        throw error;
      }
    }
  );

  return app;
}
