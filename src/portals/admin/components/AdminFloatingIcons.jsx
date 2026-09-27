import {
  IconBook,
  IconChart,
  IconCourse,
  IconGlobe,
  IconGraduationCap,
  IconLightbulb,
  IconTeach,
} from "./icons";
import "./AdminFloatingIcons.css";

const FLOATING_ICONS = [
  { Icon: IconBook, size: 20, top: "11%", left: "22%", duration: "13s", delay: "0s" },
  { Icon: IconGraduationCap, size: 22, top: "28%", left: "88%", duration: "16s", delay: "1.5s" },
  { Icon: IconChart, size: 18, top: "70%", left: "24%", duration: "15s", delay: "2.2s" },
  { Icon: IconGlobe, size: 20, top: "82%", left: "76%", duration: "18s", delay: "0.8s" },
  { Icon: IconLightbulb, size: 18, top: "8%", left: "73%", duration: "14s", delay: "2.8s" },
  { Icon: IconTeach, size: 19, top: "54%", left: "91%", duration: "17s", delay: "1s" },
  { Icon: IconCourse, size: 18, top: "88%", left: "43%", duration: "16s", delay: "3s" },
  { Icon: IconBook, size: 17, top: "42%", left: "29%", duration: "19s", delay: "1.2s" },
];

export default function AdminFloatingIcons() {
  return (
    <div className="ul-admin-floaters" aria-hidden="true">
      {FLOATING_ICONS.map(({ Icon, size, top, left, duration, delay }, index) => (
        <span
          key={index}
          className="ul-admin-floater"
          style={{ top, left, animationDuration: duration, animationDelay: delay }}
        >
          <Icon size={size} />
        </span>
      ))}
    </div>
  );
}
