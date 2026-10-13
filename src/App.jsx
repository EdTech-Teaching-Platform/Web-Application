import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { TestSeriesProvider } from "./context/TestSeriesContext";
import AppRoutes from "./routes/AppRoutes";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TestSeriesProvider>
          <AppRoutes />
        </TestSeriesProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
