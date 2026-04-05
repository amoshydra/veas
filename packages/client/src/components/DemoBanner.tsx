const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

export default function DemoBanner() {
  if (!IS_DEMO_MODE) return null;

  return (
    <a
      href="https://github.com/amoshydra/veas"
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-[#252500] text-amber-300 text-center text-sm py-1.5 hover:text-amber-200 transition-colors"
    >
      Demo Mode — To run the real server, see the README
    </a>
  );
}
