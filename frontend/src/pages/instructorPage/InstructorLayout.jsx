import InstructorOverlay from "./InstructorOverlay";

export default function InstructorLayout({ children }) {
  return (
    <div className="instructor-shell">
      <InstructorOverlay />
      {children}
    </div>
  );
}
