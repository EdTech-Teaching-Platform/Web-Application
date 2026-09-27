import apiClient from "../../../services/apiClient";

// Student portal API calls go here.
export const getDashboard = () => apiClient.get("/student/dashboard");
