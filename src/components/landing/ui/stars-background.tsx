import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
}

export function StarsBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const stars: Star[] = [];
    const starCount = 150;

    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.8 + 0.2,
        speed: Math.random() * 0.5 + 0.1,
      });
    }

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      // Recalculate star positions on resize
      stars.forEach((star) => {
        star.x = Math.random() * canvas.width;
        star.y = Math.random() * canvas.height;
      });
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    let animationId: number;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      stars.forEach((star) => {
        star.opacity += Math.sin(Date.now() * star.speed * 0.001) * 0.01;
        star.opacity = Math.max(0.1, Math.min(1, star.opacity));

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.fill();

        // Add glow effect for larger stars
        if (star.size > 1.5) {
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size * 2, 0, Math.PI * 2);
          const gradient = ctx.createRadialGradient(
            star.x, star.y, 0,
            star.x, star.y, star.size * 2
          );
          gradient.addColorStop(0, `rgba(245, 158, 11, ${star.opacity * 0.2})`);
          gradient.addColorStop(1, "transparent");
          ctx.fillStyle = gradient;
          ctx.fill();
        }
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ background: "transparent" }}
    />
  );
}

export function CosmicOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Main amber orb - responsive */}
      <div className="absolute top-1/4 left-1/4 w-32 sm:w-48 md:w-72 lg:w-96 h-32 sm:h-48 md:h-72 lg:h-96 bg-amber-600/15 rounded-full blur-[60px] sm:blur-[80px] md:blur-[100px] lg:blur-[120px] animate-pulse" />
      
      {/* Gold accent orb - responsive */}
      <div className="absolute top-1/2 right-1/4 w-32 sm:w-48 md:w-72 lg:w-96 h-32 sm:h-48 md:h-72 lg:h-96 bg-yellow-600/12 rounded-full blur-[60px] sm:blur-[80px] md:blur-[100px] lg:blur-[120px] animate-pulse" style={{ animationDelay: "1s" }} />
      
      {/* Secondary amber orb - responsive */}
      <div className="absolute bottom-1/4 left-1/3 w-24 sm:w-36 md:w-48 lg:w-72 h-24 sm:h-36 md:h-48 lg:h-72 bg-amber-500/10 rounded-full blur-[50px] sm:blur-[60px] md:blur-[80px] lg:blur-[100px] animate-pulse" style={{ animationDelay: "2s" }} />
      
      {/* Accent glow - responsive */}
      <div className="absolute top-1/3 right-1/3 w-16 sm:w-24 md:w-32 lg:w-48 h-16 sm:h-24 md:h-32 lg:h-48 bg-amber-400/8 rounded-full blur-[40px] sm:blur-[50px] md:blur-[60px] lg:blur-[80px] animate-pulse" style={{ animationDelay: "1.5s" }} />
    </div>
  );
}
