import apiClient from "./apiClient";

// Shared from the start (not portal-local): course/educator discovery data
// is consumed by both the public Explore page (src/public) AND the Student
// Dashboard's "Recommended For You" section — two consumers already, so
// this qualifies as shared per the README's "promote once 2+ consumers
// need it" rule rather than starting inside src/public and moving later.
//
// Doc ref: Section 5.3 (Discovery). Search/category browsing is one
// endpoint — filters (category, level, price, rating) and sort are all
// query params, mirroring the ExplorePage URL query-string state.

export const searchCourses = (params = {}) =>
  apiClient.get("/discovery/courses", { params });

export const getFeaturedCourses = () => apiClient.get("/discovery/courses/featured");

export const getFeaturedEducators = () => apiClient.get("/discovery/educators/featured");

export const getCategories = () => apiClient.get("/discovery/categories");

export const getPlatformStats = () => apiClient.get("/discovery/stats");

export const getRecommendedCourses = () => apiClient.get("/discovery/courses/recommended");

// Wishlist endpoints (Sec 5.3) — not built on the backend yet. The actual
// Day 3 UI (ColorBlockCard's heart toggle, the Wishlist page) uses
// src/hooks/useWishlist.js's localStorage-backed store instead so the
// feature is genuinely usable/demoable without a backend; these are left
// here as the real call shape to swap in once the endpoints exist.
export const getWishlist = () => apiClient.get("/student/wishlist");

export const addToWishlist = (courseId) => apiClient.post("/student/wishlist", { courseId });

export const removeFromWishlist = (courseId) => apiClient.delete(`/student/wishlist/${courseId}`);
