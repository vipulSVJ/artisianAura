import axios from 'axios';

const API = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api`,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

// Attach the session token from localStorage as a Bearer token on every request.
// This avoids cross-port cookie issues in local development.
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('session_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

export default API;
