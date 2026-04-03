import axios from 'axios';

const apiClient = axios.create({
    // Use relative URL in dev (Vite proxies /api → localhost:5000)
    // Use VITE_API_URL in production/deployment
    baseURL: import.meta.env.VITE_API_URL || '/api',
});

// Attach JWT token to every request automatically
apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// On 401, clear storage and redirect to login
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default apiClient;
