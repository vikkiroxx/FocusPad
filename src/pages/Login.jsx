import { signInWithGoogle } from "../services/firebase";
import { useNavigate } from "react-router-dom";
import styles from "./Login.module.css";

const Login = () => {
    const navigate = useNavigate();

    const handleLogin = async () => {
        try {
            await signInWithGoogle();
            navigate("/");
        } catch (error) {
            console.error("Login failed", error);
            alert("Login failed. Please try again.");
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <h1 className={styles.title}>FocusPad</h1>
                <p className={styles.subtitle}>Minimalist sync notes for your productivity.</p>
                <button className={styles.loginBtn} onClick={handleLogin}>
                    Sign in with Google
                </button>
            </div>
        </div>
    );
};

export default Login;
