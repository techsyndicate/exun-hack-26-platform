import "./styles/home-page.css";
import Navbar from "../components/Navbar";

export function HomePage() {
  return (
    <div className="container">
      {/* <img src={"/assets/home/bg.png"} alt="Background" /> */}
      {/* <h1>Welcome to the Los Rebeldes</h1> */}
      <Navbar />
    </div>
  );
}
