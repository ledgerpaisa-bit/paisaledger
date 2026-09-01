import axios from "axios";
import { API } from "./api";

// Separate axios client for the shop-staff billing counter login. Staff use a
// distinct token (mbt_staff_token) from the owner's own session (mbt_token),
// so a staff device never carries owner-level access and vice versa.
const staffApi = axios.create({ baseURL: API });

staffApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("mbt_staff_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

staffApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.includes("/staff-login")) {
      localStorage.removeItem("mbt_staff_token");
      localStorage.removeItem("mbt_staff_info");
      window.location.href = "/staff-login";
    }
    return Promise.reject(err);
  }
);

export default staffApi;
