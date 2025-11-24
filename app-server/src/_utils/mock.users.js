// app-server/src/_utils/mock.users.js
// This file centralizes mock user data for development and testing.

export const MOCK_USERS = [
  { uid: 1, userId: 'test', password: 'test', name: '테스트 사용자', email: 'test@example.com', department: 'QA', company: 'TestCorp', accessToken: 'mock-test-token' },
];

export const findUserByAccessToken = (accessToken) => {
  return MOCK_USERS.find(u => u.accessToken === accessToken);
};

export const findUserById = (userId) => {
  return MOCK_USERS.find(u => u.userId === userId);
};

export const addUser = (user) => {
  MOCK_USERS.push(user);
};

export const removeAccessToken = (userId) => {
  const user = MOCK_USERS.find(u => u.userId === userId);
  if (user) {
    user.accessToken = null;
    return true;
  }
  return false;
};