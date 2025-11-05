// Utility for authenticated API calls in meal.it
import { supabase } from './supabaseClient';

/**
 * Makes an authenticated API call with the user's session token
 * @param {string} url - API endpoint URL
 * @param {object} options - Fetch options (method, body, headers, etc.)
 * @returns {Promise<Response>} - Fetch response
 */
export async function authenticatedFetch(url, options = {}) {
  // Get current session
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error || !session?.access_token) {
    throw new Error('User not authenticated');
  }

  // Prepare headers with authentication
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
    ...options.headers
  };

  // Make the authenticated request
  return fetch(url, {
    ...options,
    headers
  });
}

/**
 * Makes an authenticated API call and returns parsed JSON response
 * @param {string} url - API endpoint URL
 * @param {object} options - Fetch options (method, body, headers, etc.)
 * @returns {Promise<any>} - Parsed JSON response
 */
export async function authenticatedApiCall(url, options = {}) {
  try {
    const response = await authenticatedFetch(url, options);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API call failed for ${url}:`, error);
    throw error;
  }
}

/**
 * GET request helper
 */
export async function authenticatedGet(url) {
  return authenticatedApiCall(url, { method: 'GET' });
}

/**
 * POST request helper
 */
export async function authenticatedPost(url, data) {
  return authenticatedApiCall(url, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

/**
 * PUT request helper
 */
export async function authenticatedPut(url, data) {
  return authenticatedApiCall(url, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

/**
 * DELETE request helper
 */
export async function authenticatedDelete(url) {
  return authenticatedApiCall(url, { method: 'DELETE' });
}