'use client';
import React from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { FacebookIcon, FrameIcon, InstagramIcon, LinkedinIcon, YoutubeIcon, HeartIcon } from 'lucide-react';

interface FooterLink {
	title: string;
	href: string;
	icon?: React.ComponentType<{ className?: string }>;
}

interface FooterSection {
	label: string;
	links: FooterLink[];
}

const footerLinks: FooterSection[] = [
	{
		label: 'Analyzers',
		links: [
			{ title: 'Diabetes Predictor', href: '#diabetes' },
			{ title: 'Cardiac Risk Analyzer', href: '#heart' },
			{ title: 'Clinical Symptom AI', href: '#symptoms' },
			{ title: 'SHAP Interpretability', href: '#shap' },
		],
	},
	{
		label: 'MLOps Tools',
		links: [
			{ title: 'Data Drift Showcase', href: '#drift' },
			{ title: 'Clinical Insights API', href: '#' },
			{ title: 'SHAP Value Matrices', href: '#' },
			{ title: 'Workspace Settings', href: '#' },
		],
	},
	{
		label: 'Research',
		links: [
			{ title: 'SHAP Documentation', href: 'https://shap.readthedocs.io/' },
			{ title: 'NIH Diabetes Specs', href: 'https://www.nih.gov/' },
			{ title: 'Cardiology Guidelines', href: 'https://www.acc.org/' },
			{ title: 'Help & Support', href: '#' },
		],
	},
	{
		label: 'Connect & Bio',
		links: [
			{ title: 'LinkedIn Bio', href: '#', icon: LinkedinIcon },
			{ title: 'Clinical GitHub', href: '#', icon: FacebookIcon },
			{ title: 'Medical AI Group', href: '#', icon: YoutubeIcon },
		],
	},
];

export function Footer() {
	return (
		<footer className="md:rounded-t-[2rem] relative w-full border-t border-slate-800 bg-[#0f1116] px-6 py-6 flex flex-col justify-center">
			<div className="absolute top-0 right-1/2 left-1/2 h-px w-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full blur" />

			<div className="w-full px-2 lg:px-8 grid gap-6 xl:grid-cols-3 xl:gap-12 items-start">
				<AnimatedContainer className="space-y-3">
					<div className="flex items-center gap-2">
						<HeartIcon className="size-5 text-emerald-400 animate-pulse" />
						<span className="font-serif italic tracking-tight text-emerald-400 text-xl">HealthGuard AI</span>
					</div>
					<p className="text-slate-400 text-xs leading-relaxed max-w-xs">
						An advanced ML playground for physician review, SHAP interpretability, and continuous data governance monitoring.
					</p>
					<p className="text-slate-500 text-xs">
						© {new Date().getFullYear()} HealthGuard AI. All rights reserved.
					</p>
				</AnimatedContainer>

				<div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4 xl:col-span-2 xl:gap-x-8">
					{footerLinks.map((section, index) => (
						<AnimatedContainer key={section.label} delay={0.1 + index * 0.1}>
							<div>
								<h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest">{section.label}</h3>
								<ul className="text-slate-400 mt-3 space-y-3 text-xs list-none m-0 p-0">
									{section.links.map((link) => (
										<li key={link.title} className="m-0 p-0">
											<a
												href={link.href}
												className="hover:text-emerald-400 inline-flex items-center transition-all duration-300 no-underline hover:translate-x-1"
											>
												{link.icon && <link.icon className="me-2 size-3.5 text-emerald-400/80" />}
												{link.title}
											</a>
										</li>
									))}
								</ul>
							</div>
						</AnimatedContainer>
					))}
				</div>
			</div>
		</footer>
	);
};

type ViewAnimationProps = {
	delay?: number;
	className?: ComponentProps<typeof motion.div>['className'];
	children: ReactNode;
	key?: string;
};

function AnimatedContainer({ className, delay = 0.1, children }: ViewAnimationProps) {
	const shouldReduceMotion = useReducedMotion();

	if (shouldReduceMotion) {
		return <div className={className}>{children}</div>;
	}

	return (
		<motion.div
			initial={{ filter: 'blur(4px)', translateY: -8, opacity: 0 }}
			whileInView={{ filter: 'blur(0px)', translateY: 0, opacity: 1 }}
			viewport={{ once: false, margin: "-40px" }}
			transition={{ delay, duration: 0.8 }}
			className={className}
		>
			{children}
		</motion.div>
	);
};
