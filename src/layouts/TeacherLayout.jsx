import { Outlet } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Sidebar from "../components/common/Sidebar";

const links = [
  { href: "/teacher/dashboard", label: "Dashboard" },
  { href: "/teacher/mycourses", label: "My Courses" },
];

export default function TeacherLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar title="Educator Portal" links={links} />
      <div className="flex flex-1">
        <Sidebar items={links} />
        <main className="flex-1 bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
