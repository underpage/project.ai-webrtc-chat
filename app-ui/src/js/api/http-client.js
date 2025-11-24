import logger from '../utils/logger.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

class HttpClient {
  async _request(method, url, data = null, authenticated = false) {
    const fullUrl = `${API_BASE_URL}${url}`;
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (authenticated) {
      const token = localStorage.getItem('accessToken');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const config = {
      method,
      headers,
    };

    if (data) {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(fullUrl, config);
      const responseData = await response.json();

      if (!response.ok) {
        const error = responseData.error || { message: 'An unknown error occurred.' };
        logger.error(`API Error on ${method} ${url}:`, error);
        throw new Error(error.message);
      }

      return responseData.data;

    } catch (error) {
      logger.error(`HTTP Client Error: ${method} ${url}`, error);
      throw error; 
    }
  }

  get(url, authenticated = false) {
    return this._request('GET', url, null, authenticated);
  }

  post(url, data, authenticated = false) {
    return this._request('POST', url, data, authenticated);
  }

  put(url, data, authenticated = true) {
    return this._request('PUT', url, data, authenticated);
  }

  delete(url, authenticated = true) {
    return this._request('DELETE', url, null, authenticated);
  }
}

export const httpClient = new HttpClient();