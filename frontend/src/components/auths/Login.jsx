import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import {
  ArrowRight,
  Cpu,
  Eye,
  EyeOff,
  ShieldCheck,
  User,
} from "lucide-react";

/**
 * Admin Login Component
 * Features: Classic Aesthetic, Underline Inputs, Floating Bubbles
 * Updated to be self-contained for the preview environment.
 */
export default function Login() {
  const navigate = useNavigate();
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bubbles, setBubbles] = useState([]);

  // Generate background animation elements
  useEffect(() => {
    const generated = Array.from({ length: 9 }).map((_, index) => ({
      id: index,
      size: 120 + Math.random() * 160,
      left: Math.random() * 95,
      top: Math.random() * 95,
      duration: 12 + Math.random() * 10,
      delay: Math.random() * 5,
    }));
    setBubbles(generated);
  }, []);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/admin/login", {
        email: adminEmail,
        password: adminPassword,
      });
      localStorage.setItem("admin_token", res.data.token);
      localStorage.setItem("admin_email", adminEmail);
      navigate("/login-success");
    } catch {
      setError("Invalid admin credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Moving Background Elements */}
      {bubbles.map((bubble) => (
        <span
          key={bubble.id}
          className="bg-bubble"
          style={{
            width: `${bubble.size}px`,
            height: `${bubble.size}px`,
            left: `${bubble.left}%`,
            top: `${bubble.top}%`,
            animationDuration: `${bubble.duration}s`,
            animationDelay: `${bubble.delay}s`,
          }}
        />
      ))}

      <section className="login-shell">
        <header className="brand reveal">
          <span className="brand-icon">
            <Cpu size={24} />
          </span>
          <h1>AI Mock Interview</h1>
          <p>Admin Portal</p>
        </header>

        <main className="login-card reveal-up">
          <h2>Sign In</h2>
          <p className="card-subtitle">
            Classic interface for secure administrator access.
          </p>

          <form onSubmit={handleAdminLogin} className="login-form">
            <label className="line-field">
              <span>Admin Email</span>
              <div className="line-input-row">
                <User size={16} />
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@aimock.com"
                />
              </div>
            </label>

            <label className="line-field">
              <span>Password</span>
              <div className="line-input-row">
                <ShieldCheck size={16} />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter your password"
                />
                <button
                  className="toggle-visibility"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <div className="auth-actions">
              <button
                type="button"
                className="forgot-btn"
                onClick={() =>
                  navigate(`/admin/forgot-password?email=${encodeURIComponent(adminEmail)}`)
                }
              >
                Forgot password?
              </button>
            </div>

            {error && <p className="error-text">{error}</p>}

            <button className="submit-btn" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Login"}
              {!loading && <ArrowRight size={17} />}
            </button>
          </form>

          <div className="auth-note">
            <button 
              className="register-btn" 
              type="button"
              onClick={() => navigate("/admin/register")}
            >
              Create Admin Account
            </button>
          </div>
        </main>
      </section>

      <style>{`
        :root {
          --beige-100: #f9f4e8;
          --beige-200: #efe6d3;
          --blue-100: #dbeeff;
          --blue-500: #4c84b8;
          --blue-700: #2e5f8a;
          --ink: #21384d;
          --muted: #5e7487;
          --card: #fffefb;
          --line: #b8c9d8;
          --line-focus: #3f77ad;
          --error: #b8475d;
        }

        .login-page {
          min-height: 100vh;
          display: grid;
          place-items: center;
          position: relative;
          overflow: hidden;
          padding: 28px;
          font-family: "Georgia", "Times New Roman", serif;
          background:
            radial-gradient(circle at 15% 15%, var(--blue-100), transparent 45%),
            radial-gradient(circle at 85% 85%, #f4ead8, transparent 50%),
            linear-gradient(120deg, var(--beige-100), #f7f0e2 50%, #edf5fc);
          color: var(--ink);
        }

        .bg-bubble {
          position: absolute;
          border-radius: 999px;
          background: rgba(133, 176, 217, 0.15);
          filter: blur(3px);
          animation-name: floatBubble;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          z-index: 1;
        }

        .login-shell {
          width: min(460px, 100%);
          position: relative;
          z-index: 2;
        }

        .brand {
          display: grid;
          justify-items: center;
          gap: 8px;
          margin-bottom: 22px;
          text-align: center;
        }

        .brand-icon {
          width: 52px;
          height: 52px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          color: var(--blue-700);
          background: rgba(219, 238, 255, 0.9);
          border: 1px solid rgba(46, 95, 138, 0.24);
        }

        .brand h1 {
          margin: 0;
          font-size: clamp(1.55rem, 2.8vw, 1.85rem);
          letter-spacing: 0.03em;
          text-transform: uppercase;
          color: #1f3d57;
        }

        .brand p {
          margin: 0;
          font-size: 0.8rem;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--muted);
          font-family: "Trebuchet MS", "Segoe UI", sans-serif;
        }

        .login-card {
          border-radius: 14px;
          border: 1px solid rgba(46, 95, 138, 0.2);
          background: linear-gradient(180deg, rgba(255, 254, 251, 0.96), rgba(255, 251, 243, 0.94));
          box-shadow: 0 18px 45px rgba(38, 67, 93, 0.12);
          padding: 28px 26px;
          backdrop-filter: blur(2px);
        }

        .login-card h2 {
          margin: 0;
          font-size: 1.4rem;
          color: #224866;
        }

        .card-subtitle {
          margin: 8px 0 24px;
          font-size: 0.93rem;
          line-height: 1.5;
          color: var(--muted);
          font-family: "Trebuchet MS", "Segoe UI", sans-serif;
        }

        .login-form {
          display: grid;
          gap: 18px;
        }

        .line-field {
          display: grid;
          gap: 7px;
        }

        .line-field > span {
          font-size: 0.74rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #426684;
          font-family: "Trebuchet MS", "Segoe UI", sans-serif;
          font-weight: 700;
        }

        .line-input-row {
          display: flex;
          align-items: center;
          gap: 10px;
          border-bottom: 1.8px solid var(--line);
          padding: 9px 2px;
          transition: border-color 180ms ease, transform 180ms ease;
          color: #4f7594;
        }

        .line-input-row:focus-within {
          border-bottom-color: var(--line-focus);
          transform: translateY(-1px);
        }

        .line-input-row input {
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: #1f3d57;
          font-size: 0.96rem;
          font-family: "Trebuchet MS", "Segoe UI", sans-serif;
        }

        .line-input-row input::placeholder {
          color: #8ca4b9;
        }

        .toggle-visibility {
          border: 0;
          outline: 0;
          background: transparent;
          display: grid;
          place-items: center;
          color: #577d9c;
          cursor: pointer;
          transition: color 160ms ease;
          padding: 0;
        }

        .auth-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: -5px;
        }

        .forgot-btn {
          border: 0;
          background: transparent;
          color: var(--blue-700);
          font-size: 0.8rem;
          cursor: pointer;
          font-family: "Trebuchet MS", "Segoe UI", sans-serif;
          font-weight: 600;
        }

        .error-text {
          margin: 0;
          color: var(--error);
          font-size: 0.88rem;
          font-family: "Trebuchet MS", "Segoe UI", sans-serif;
        }

        .submit-btn {
          margin-top: 10px;
          border: 0;
          background: linear-gradient(180deg, var(--blue-500), #3f75a8);
          color: #f7fbff;
          padding: 12px 16px;
          border-radius: 6px;
          font-size: 0.84rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          font-weight: 700;
          display: inline-flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: transform 220ms ease, box-shadow 220ms ease;
          font-family: "Trebuchet MS", "Segoe UI", sans-serif;
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 10px 24px rgba(47, 97, 140, 0.24);
        }

        .submit-btn:disabled {
          opacity: 0.8;
          cursor: not-allowed;
        }

        .auth-note {
          margin-top: 25px;
          text-align: center;
          border-top: 1px solid rgba(46, 95, 138, 0.1);
          padding-top: 20px;
        }

        .register-btn {
          background: transparent;
          border: 1px solid var(--blue-500);
          color: var(--blue-700);
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 0.75rem;
          text-transform: uppercase;
          font-weight: 700;
          cursor: pointer;
          transition: all 200ms ease;
          font-family: "Trebuchet MS", "Segoe UI", sans-serif;
        }

        .register-btn:hover {
          background: var(--blue-100);
          border-color: var(--blue-700);
        }

        .reveal { animation: reveal 0.75s ease-out both; }
        .reveal-up { animation: revealUp 0.8s ease-out both; animation-delay: 0.06s; }

        @keyframes reveal {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes revealUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes floatBubble {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(18px, -22px, 0); }
        }

        @media (max-width: 600px) {
          .login-page { padding: 18px; }
          .login-card { padding: 22px 18px; }
        }
      `}</style>
    </div>
  );
}



// import React, { useState } from "react";
// import { useNavigate } from "react-router-dom";
// import api from "../../services/api";
// import "./auth-basic.css";

// export default function Login() {
//   const navigate = useNavigate();
//   const [adminEmail, setAdminEmail] = useState("");
//   const [adminPassword, setAdminPassword] = useState("");
//   const [showPassword, setShowPassword] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");

//   const handleAdminLogin = async () => {
//     setError("");
//     setLoading(true);
//     try {
//       const res = await api.post("/auth/admin/login", {
//         email: adminEmail,
//         password: adminPassword,
//       });
//       localStorage.setItem("admin_token", res.data.token);
//       localStorage.setItem("admin_email", adminEmail);
//       navigate("/login-success");
//     } catch {
//       setError("Invalid admin credentials");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="auth-page">
//       <div className="auth-card">
//         <h1 className="auth-title">Admin Login</h1>
//         <p className="auth-subtitle">Sign in to continue.</p>

//         <div className="auth-form">
//           <input
//             className="auth-input"
//             type="email"
//             required
//             value={adminEmail}
//             onChange={(e) => setAdminEmail(e.target.value)}
//             placeholder="Admin Email"
//           />
//           <input
//             className="auth-input"
//             type={showPassword ? "text" : "password"}
//             required
//             value={adminPassword}
//             onChange={(e) => setAdminPassword(e.target.value)}
//             placeholder="Password"
//           />
//           <div className="auth-actions">
//             <label>
//               <input
//                 type="checkbox"
//                 checked={showPassword}
//                 onChange={(e) => setShowPassword(e.target.checked)}
//               />{" "}
//               Show password
//             </label>
//             <button
//               className="auth-btn"
//               onClick={() =>
//                 navigate(`/admin/forgot-password?email=${encodeURIComponent(adminEmail)}`)
//               }
//             >
//               Forgot password
//             </button>
//           </div>
//           {error && <div className="auth-error">{error}</div>}
//           <button className="auth-btn" onClick={handleAdminLogin} disabled={loading}>
//             {loading ? "Signing in..." : "Login"}
//           </button>
//         </div>

//         <div className="auth-note">
//           <button className="auth-btn" onClick={() => navigate("/admin/register")}>
//             Create Admin Account
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }
