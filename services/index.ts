/**
 * Services Index
 * 
 * Centralized exports for all application services
 */

// Data service
export { dataService } from './dataService';

// Auth service
export { authService } from './authService';

// API client
export { api, getToken, setToken, removeToken, APIError } from './apiClient';

// Legacy exports for backward compatibility
export { dataService as default } from './dataService';
