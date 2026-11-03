import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ErrorBoundary from "./components/common/ErrorBoundary";
import AppRoutes from "./routes/AppRoutes";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* last resort: a crash in a layout itself still shows a readable panel */}
        <ErrorBoundary name="app">
          <AppRoutes />
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}
