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
      {/* Purple orb — top-right */}
      <div
        className="absolute rounded-full"
        style={{
          width: '600px', height: '600px',
          background: 'radial-gradient(circle, rgba(168,85,247,0.14) 0%, transparent 70%)',
          filter: 'blur(100px)',
          top: '-150px', right: '-100px',
          animation: 'cosmicDrift 14s ease-in-out infinite alternate',
        }}
      />
      {/* Amber orb — bottom-left */}
      <div
        className="absolute rounded-full"
        style={{
          width: '450px', height: '450px',
          background: 'radial-gradient(circle, rgba(245,158,11,0.09) 0%, transparent 70%)',
          filter: 'blur(100px)',
          bottom: '20%', left: '-80px',
          animation: 'cosmicDrift 14s ease-in-out infinite alternate',
          animationDelay: '-5s',
        }}
      />
      {/* Rose accent orb — mid-right */}
      <div
        className="absolute rounded-full"
        style={{
          width: '300px', height: '300px',
          background: 'radial-gradient(circle, rgba(244,63,94,0.07) 0%, transparent 70%)',
          filter: 'blur(100px)',
          top: '60%', right: '18%',
          animation: 'cosmicDrift 14s ease-in-out infinite alternate',
          animationDelay: '-9s',
        }}
      />
    </div>
  );
}
