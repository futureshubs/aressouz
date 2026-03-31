/**
 * Production-ready base repository
 * Provides common database operations and error handling
 */

import { createClient } from '@supabase/supabase-js';
import { DatabaseError } from '../middleware/error.js';

export abstract class BaseRepository {
  protected supabase: any;

  constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Execute database query with error handling
   */
  protected async executeQuery<T>(
    queryBuilder: any,
    operation: string
  ): Promise<T> {
    try {
      const { data, error } = await queryBuilder;

      if (error) {
        throw new DatabaseError(
          `Database ${operation} failed: ${error.message}`,
          {
            operation,
            details: error,
            hint: error.hint,
            code: error.code
          }
        );
      }

      return data;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      
      throw new DatabaseError(
        `Unexpected database error during ${operation}`,
        { operation, originalError: error }
      );
    }
  }

  /**
   * Find single record by ID
   */
  protected async findById<T>(
    table: string,
    id: string,
    columns: string = '*'
  ): Promise<T | null> {
    return this.executeQuery<T>(
      this.supabase.from(table).select(columns).eq('id', id).single(),
      `findById(${table}, ${id})`
    ).catch(() => null);
  }

  /**
   * Find multiple records with filters
   */
  protected async findMany<T>(
    table: string,
    filters: Record<string, any> = {},
    columns: string = '*',
    orderBy: { column: string; ascending?: boolean } = { column: 'created_at', ascending: false }
  ): Promise<T[]> {
    let query = this.supabase.from(table).select(columns);

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else {
          query = query.eq(key, value);
        }
      }
    });

    // Apply ordering
    query = query.order(orderBy.column, { ascending: orderBy.ascending ?? false });

    return this.executeQuery<T[]>(
      query,
      `findMany(${table})`
    );
  }

  /**
   * Create new record
   */
  protected async create<T>(
    table: string,
    data: Partial<T>
  ): Promise<T> {
    return this.executeQuery<T>(
      this.supabase.from(table).insert(data).select().single(),
      `create(${table})`
    );
  }

  /**
   * Update record by ID
   */
  protected async update<T>(
    table: string,
    id: string,
    data: Partial<T>
  ): Promise<T> {
    return this.executeQuery<T>(
      this.supabase
        .from(table)
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single(),
      `update(${table}, ${id})`
    );
  }

  /**
   * Delete record by ID
   */
  protected async delete(
    table: string,
    id: string
  ): Promise<void> {
    await this.executeQuery(
      this.supabase.from(table).delete().eq('id', id),
      `delete(${table}, ${id})`
    );
  }

  /**
   * Count records with filters
   */
  protected async count(
    table: string,
    filters: Record<string, any> = {}
  ): Promise<number> {
    let query = this.supabase.from(table).select('*', { count: 'exact', head: true });

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else {
          query = query.eq(key, value);
        }
      }
    });

    const result = await this.executeQuery(
      query,
      `count(${table})`
    );

    const count = (result as any)?.count || 0;
    return count;
  }

  /**
   * Paginated query
   */
  protected async findWithPagination<T>(
    table: string,
    page: number = 1,
    limit: number = 20,
    filters: Record<string, any> = {},
    columns: string = '*',
    orderBy: { column: string; ascending?: boolean } = { column: 'created_at', ascending: false }
  ): Promise<{ data: T[]; total: number; page: number; limit: number; totalPages: number }> {
    const offset = (page - 1) * limit;

    // Get total count
    const total = await this.count(table, filters);

    // Get paginated data
    let query = this.supabase
      .from(table)
      .select(columns)
      .range(offset, offset + limit - 1);

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else {
          query = query.eq(key, value);
        }
      }
    });

    // Apply ordering
    query = query.order(orderBy.column, { ascending: orderBy.ascending ?? false });

    const data = await this.executeQuery<T[]>(
      query,
      `findWithPagination(${table})`
    );

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Execute raw SQL query
   */
  protected async executeRaw<T>(
    sql: string,
    params: any[] = []
  ): Promise<T[]> {
    return this.executeQuery<T[]>(
      this.supabase.rpc('execute_sql', { query: sql, params }),
      `executeRaw(${sql})`
    );
  }

  /**
   * Check if record exists
   */
  protected async exists(
    table: string,
    filters: Record<string, any>
  ): Promise<boolean> {
    const count = await this.count(table, filters);
    return count > 0;
  }

  /**
   * Find records with text search
   */
  protected async search<T>(
    table: string,
    searchTerm: string,
    searchColumns: string[],
    filters: Record<string, any> = {},
    columns: string = '*',
    orderBy: { column: string; ascending?: boolean } = { column: 'created_at', ascending: false }
  ): Promise<T[]> {
    let query = this.supabase.from(table).select(columns);

    // Apply text search
    if (searchTerm && searchColumns.length > 0) {
      const searchConditions = searchColumns.map(column => `${column}.ilike.%${searchTerm}%`).join(',');
      query = query.or(searchConditions);
    }

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else {
          query = query.eq(key, value);
        }
      }
    });

    // Apply ordering
    query = query.order(orderBy.column, { ascending: orderBy.ascending ?? false });

    return this.executeQuery<T[]>(
      query,
      `search(${table}, ${searchTerm})`
    );
  }

  /**
   * Transaction support
   */
  protected async transaction<T>(
    callback: (supabase: any) => Promise<T>
  ): Promise<T> {
    try {
      const result = await callback(this.supabase);
      return result;
    } catch (error: any) {
      throw new DatabaseError(
        `Transaction failed: ${error?.message || 'Unknown error'}`,
        { originalError: error }
      );
    }
  }
}
