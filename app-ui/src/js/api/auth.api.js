import { httpClient } from './http-client.js';

export const login = async (userId, password) => {
  const payload = { userId, password };
  const response = await httpClient.post('/auth/login', payload, false);
  return response;
};

export const signup = async (signupData) => {
  const response = await httpClient.post('/auth/signup', signupData, false);
  return response;
};

export const getMe = async () => {
    return httpClient.get('/auth/me', true);
};
