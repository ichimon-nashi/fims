// src/hooks/useDashboardMotion.ts
"use client";

import { useCallback, useEffect, useRef } from "react";
import { animate, createTimeline, stagger, utils } from "animejs";

/**
 * Drives the dashboard intro + ambient motion with anime.js v4.
 *
 * Markup contract (all optional — missing hooks are simply skipped):
 *   data-anim="welcome" | "sub" | "weather" | "avatar" | "panel" | "badge" | "risk" | "tile"
 *   data-count="184" data-suffix="人"     → counts up from 0 on mount
 *   data-donut  (circle, stroke-dasharray) + data-donut-value="179" data-donut-circ="264"
 *   data-bar    data-bar-value="68"        → width fill
 *   data-sheen                             → one sweep across the bar
 *   data-pulse="on"                        → looping pulse (overdue dots)
 *   data-float                             → looping float (weather icon)
 *   data-glow="a" | "b"                    → slow ambient drift
 *
 * @param ready  flip true once data has landed, so numbers animate to real values
 */
export function useDashboardMotion(ready: boolean, intensity = 1) {
	const rootRef = useRef<HTMLDivElement | null>(null);
	const playedRef = useRef(false);

	const q = useCallback(<T extends Element = HTMLElement>(sel: string): T[] => {
		const root = rootRef.current;
		return root ? (Array.from(root.querySelectorAll(sel)) as T[]) : [];
	}, []);

	const playIntro = useCallback(() => {
		const reduce =
			typeof window !== "undefined" &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches;

		const anims = q("[data-anim]");
		if (reduce) {
			utils.set(anims, { opacity: 1, translateX: 0, translateY: 0, scale: 1 });
			q("[data-bar]").forEach((el) => {
				el.style.width = `${el.dataset.barValue ?? 0}%`;
			});
			return;
		}

		const s = 1 / (intensity <= 0 ? 0.0001 : intensity); // higher intensity = faster

		utils.set(anims, { opacity: 0 });
		utils.set(q("[data-bar]"), { width: "0%" });

		createTimeline({ defaults: { ease: "out(3)", duration: 700 * s } })
			.add(q("[data-anim='welcome']"), { opacity: [0, 1], translateY: [-18, 0] }, 0)
			.add(q("[data-anim='sub']"), { opacity: [0, 1], translateX: [-10, 0], duration: 500 * s }, 220 * s)
			.add(q("[data-anim='weather']"), { opacity: [0, 1], scale: [0.9, 1], translateY: [-8, 0] }, 260 * s)
			.add(q("[data-anim='avatar']"), { opacity: [0, 1], scale: [0.4, 1], ease: "outElastic(1, .55)", duration: 900 * s }, 340 * s)
			.add(q("[data-anim='panel']"), { opacity: [0, 1], translateY: [26, 0], delay: stagger(110 * s) }, 300 * s)
			.add(q("[data-anim='badge']"), { opacity: [0, 1], scale: [0.6, 1], ease: "outBack(2.5)", duration: 500 * s }, 700 * s)
			.add(q("[data-anim='risk']"), { opacity: [0, 1], translateX: [-16, 0], delay: stagger(70 * s), duration: 560 * s }, 560 * s)
			.add(q("[data-anim='tile']"), { opacity: [0, 1], scale: [0.86, 1], translateY: [12, 0], delay: stagger(45 * s), duration: 620 * s }, 620 * s);

		// Donut arc draw
		q<SVGCircleElement>("[data-donut]").forEach((el) => {
			const value = Number(el.dataset.donutValue ?? 0);
			const circ = Number(el.dataset.donutCirc ?? 264);
			animate(el, {
				strokeDasharray: [`0 ${circ}`, `${value} ${circ}`],
				duration: 1500 * s,
				delay: 800 * s,
				ease: "inOut(2.5)",
			});
		});

		// Progress bar + sheen sweep
		q("[data-bar]").forEach((el) => {
			animate(el, {
				width: ["0%", `${el.dataset.barValue ?? 0}%`],
				duration: 1400 * s,
				delay: 900 * s,
				ease: "out(3)",
			});
		});
		animate(q("[data-sheen]"), {
			translateX: [-120, 320],
			duration: 1200 * s,
			delay: 1900 * s,
			ease: "inOut(2)",
		});

		// Count-up numbers
		q("[data-count]").forEach((el, i) => {
			const target = Number(el.dataset.count ?? 0);
			const suffix = el.dataset.suffix ?? "";
			const proxy = { v: 0 };
			animate(proxy, {
				v: target,
				duration: 1400 * s,
				delay: (800 + i * 90) * s,
				ease: "out(3)",
				onUpdate: () => {
					el.textContent = `${Math.round(proxy.v)}${suffix}`;
				},
			});
		});
	}, [q, intensity]);

	// Intro once, as soon as real data is in
	useEffect(() => {
		if (!ready || playedRef.current) return;
		playedRef.current = true;
		const raf = requestAnimationFrame(playIntro);
		return () => cancelAnimationFrame(raf);
	}, [ready, playIntro]);

	// Ambient loops
	useEffect(() => {
		if (!ready) return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

		const loops = [
			animate(q("[data-float]"), { translateY: [0, -6, 0], rotate: [0, -6, 0], duration: 3600, loop: true, ease: "inOut(2)" }),
			animate(q("[data-pulse='on']"), { scale: [1, 1.9, 1], opacity: [1, 0.45, 1], duration: 1500, loop: true, ease: "inOut(2)" }),
			animate(q("[data-glow='a']"), { translateX: [0, 90, 0], translateY: [0, 60, 0], duration: 18000, loop: true, ease: "inOut(2)" }),
			animate(q("[data-glow='b']"), { translateX: [0, -70, 0], translateY: [0, -50, 0], duration: 22000, loop: true, ease: "inOut(2)" }),
		];
		return () => loops.forEach((a) => a?.revert?.());
	}, [ready, q]);

	// Tile hover: pointer devices only
	const canHover = () =>
		typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;

	const onTileEnter = useCallback((e: React.MouseEvent<HTMLElement>) => {
		if (!canHover()) return;
		const icon = e.currentTarget.querySelector("[data-tile-icon]");
		if (icon) animate(icon, { scale: 1.14, rotate: -6, duration: 420, ease: "outBack(3)" });
		animate(e.currentTarget, { translateY: -3, duration: 320, ease: "out(3)" });
	}, []);

	const onTileLeave = useCallback((e: React.MouseEvent<HTMLElement>) => {
		if (!canHover()) return;
		const icon = e.currentTarget.querySelector("[data-tile-icon]");
		if (icon) animate(icon, { scale: 1, rotate: 0, duration: 420, ease: "out(3)" });
		animate(e.currentTarget, { translateY: 0, duration: 320, ease: "out(3)" });
	}, []);

	return { rootRef, playIntro, onTileEnter, onTileLeave };
}
