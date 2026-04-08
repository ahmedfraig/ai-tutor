import axios from 'axios';

const apiClient = axios.create({
    // Dev: Vite proxy forwards /api → localhost:5000 (see vite.config.js)
    // Prod: VITE_API_URL must be set to your Render backend URL
    //       e.g. https://your-backend.onrender.com/api
    baseURL: import.meta.env.VITE_API_URL || '/api',
    // MED-3: withCredentials=true sends the HttpOnly 'authToken' cookie automatically.
    // The browser handles it — JS never reads it, making XSS token theft impossible.
    withCredentials: true,
});

// No Authorization header interceptor needed — the HttpOnly cookie is sent automatically.
// We still keep the localStorage 'user' object for display purposes (name, email) —
// this is non-sensitive UI data only, NOT the authentication credential.

// On 401, clear display data and redirect to login —
// BUT only if:
//   1. The failed request was NOT an auth endpoint (login/register return 401 for wrong creds)
//   2. The user is NOT already on the login or register page (avoids infinite reload)
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        const isAuthEndpoint = error.config?.url?.includes('/auth/');
        const isAlreadyOnAuthPage = ['/login', '/register'].some((p) =>
            window.location.pathname.startsWith(p)
        );

        if (error.response?.status === 401 && !isAuthEndpoint && !isAlreadyOnAuthPage) {
            localStorage.removeItem('user');
            window.location.href = '/login';
        }

        return Promise.reject(error);
    }
);

export default apiClient;
