function startGoogleLogin() {
    const width = 500;
    const height = 600;
    const left = window.innerWidth / 2 - width / 2;
    const top = window.innerHeight / 2 - height / 2;

    const popup = window.open(
        "/auth/google",
        "google_login",
        `width=${width},height=${height},top=${top},left=${left}`
    );

    window.addEventListener("message", function (event) {
        if (event.data === "google_login_success") {
            window.location.href = "/panel";
        }
    });
}
document.getElementById("loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const loginData = Object.fromEntries(new FormData(e.target));
    const btn = e.target.querySelector("button");

    const originalText = btn.textContent;
    btn.textContent = "Verificando...";
    btn.disabled = true;
    try {
        const res = await fetch("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(loginData)
        });
        const data = await res.json();
        if (data.success) {
            const Toast = Swal.mixin({
                toast: true,
                position: "top",
                showConfirmButton: false,
                timer: 1500,
                timerProgressBar: true
            });
            await Toast.fire({ icon: "success", title: "¡Bienvenido!" });
            window.location.href = "/panel";
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        Swal.fire({
            icon: "error",
            title: "Acceso Denegado",
            text: error.message || "Usuario o contraseña incorrectos",
            confirmButtonColor: "#4f46e5",
            customClass: { popup: "rounded-2xl" }
        });
        btn.textContent = originalText;
        btn.disabled = false;
    }
});

document.getElementById("registerForm").addEventListener("submit", async e => {
    e.preventDefault();
    const registerData = Object.fromEntries(new FormData(e.target));

    if (registerData.password !== registerData.confirmPassword) {
        return Swal.fire("Error", "Las contraseñas no coinciden", "error");
    }
    try {
        const res = await fetch("/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(registerData)
        });
        const data = await res.json();
        if (data.success) {
            await Swal.fire({
                icon: "success",
                title: "¡Cuenta Creada!",
                text: "Ahora puedes iniciar sesión",
                timer: 2000,
                showConfirmButton: false
            });
            window.location.href = "/auth/login";
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        Swal.fire("Error", error.message || "Error al registrar", "error");
    }
});