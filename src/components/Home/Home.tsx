import headerImage from "../../images/header.png";

export default function Home() {
  return (
    <div className="relative h-[90.9vh] flex items-center justify-end sm:justify-center text-white box-border">

      <img
        src={headerImage}
        alt="Header"
        className="absolute inset-0 w-full h-full object-cover z-0"
      />

      <div className="relative z-10 max-w-[700px] w-full px-8 sm:px-6 xs:px-4 ml-230">
        <h1 className="text-[3.5rem] md:text-[3rem] sm:text-[2.2rem] xs:text-[1.8rem] font-bold mb-4">
          Welcome to Our Styles
        </h1>
        <h2 className="text-2xl md:text-[1.8rem] sm:text-[1.4rem] xs:text-[1.2rem] mb-4">
          A Journey Through Western Styles
        </h2>
        <p className="text-[1.2rem] md:text-[1.1rem] sm:text-[1rem] xs:text-[0.95rem] mb-0">
          Delight in Western Style without stretching your budget.
        </p>
      </div>

    </div>
  );
}
