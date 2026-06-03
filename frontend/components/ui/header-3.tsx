'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MenuToggleIcon } from '@/components/ui/menu-toggle-icon';
import { createPortal } from 'react-dom';
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { LucideIcon } from 'lucide-react';
import {
	CodeIcon,
	GlobeIcon,
	LayersIcon,
	UserPlusIcon,
	Users,
	Star,
	FileText,
	Shield,
	RotateCcw,
	Handshake,
	Leaf,
	HelpCircle,
	BarChart,
	PlugIcon,
	Activity,
	Heart,
	Sliders,
	TrendingUp,
	BookOpen
} from 'lucide-react';

type LinkItem = {
	title: string;
	tabId?: string;
	icon: LucideIcon;
	description?: string;
};

interface HeaderProps {
	activeTab?: string;
	onTabChange?: (tabId: string) => void;
	onSignInClick?: () => void;
	isSignedIn?: boolean;
	userEmail?: string;
	onSignOut?: () => void;
}

export function Header({ activeTab, onTabChange, onSignInClick, isSignedIn, userEmail, onSignOut }: HeaderProps) {
	const [open, setOpen] = React.useState(false);
	const scrolled = useScroll(10);

	React.useEffect(() => {
		if (open) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
		return () => {
			document.body.style.overflow = '';
		};
	}, [open]);

	const handleLinkClick = (e: React.MouseEvent, tabId?: string) => {
		e.preventDefault();
		if (tabId && onTabChange) {
			onTabChange(tabId);
		}
		setOpen(false);
	};

	return (
		<header
			className={cn('sticky top-0 z-50 w-full border-b border-slate-800 bg-[#0a0b0e]/95 backdrop-blur-lg transition-all duration-300')}
		>
			<nav className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 lg:px-8">
				<div className="flex items-center gap-5">
					<a href="#" onClick={(e) => handleLinkClick(e, 'dashboard')} className="hover:bg-slate-900 rounded-lg p-2 transition-colors flex items-center gap-2">
						<span className="text-xl">🩺</span>
						<span className="font-serif italic text-emerald-400 font-medium tracking-tight text-xl">HealthGuard AI</span>
					</a>
					<NavigationMenu className="hidden md:flex">
						<NavigationMenuList>
							<NavigationMenuItem>
								<NavigationMenuTrigger className="bg-transparent text-slate-300 hover:text-white">Features Hub</NavigationMenuTrigger>
								<NavigationMenuContent className="p-1 pr-1.5 bg-[#14171c] border border-slate-800">
									<ul className="grid w-lg grid-cols-2 gap-2 rounded-md border border-slate-800 p-2 shadow-lg bg-[#14171c] list-none m-0">
										{productLinks.map((item, i) => (
											<li key={i}>
												<ListItem 
													{...item} 
													onClick={(e) => handleLinkClick(e, item.tabId)} 
													data-active={activeTab === item.tabId}
												/>
											</li>
										))}
									</ul>
									<div className="p-2 border-t border-slate-800">
										<p className="text-slate-500 text-xs text-center">
											Want model customization?{' '}
											<a href="#" onClick={(e) => handleLinkClick(e, 'dashboard')} className="text-emerald-400 font-medium hover:underline">
												Read research specs
											</a>
										</p>
									</div>
								</NavigationMenuContent>
							</NavigationMenuItem>
							<NavigationMenuItem>
								<NavigationMenuTrigger className="bg-transparent text-slate-300 hover:text-white">About Suite</NavigationMenuTrigger>
								<NavigationMenuContent className="p-1 pr-1.5 pb-1.5 bg-[#14171c] border border-slate-800">
									<div className="grid w-lg grid-cols-2 gap-2">
										<ul className="space-y-2 rounded-md border border-slate-800 p-2 shadow-sm bg-[#0f1116] list-none m-0">
											{companyLinks.map((item, i) => (
												<li key={i}>
													<ListItem 
														{...item} 
														onClick={(e) => handleLinkClick(e, item.tabId)}
														data-active={activeTab === item.tabId}
													/>
												</li>
											))}
										</ul>
										<ul className="space-y-2 p-3 list-none m-0 bg-[#14171c]">
											{companyLinks2.map((item, i) => (
												<li key={i}>
													<a
														href="#"
														onClick={(e) => handleLinkClick(e, item.tabId)}
														className="flex p-2 hover:bg-slate-800 flex-row rounded-md items-center gap-x-2 text-slate-300 font-medium text-xs no-underline"
													>
														<item.icon className="text-emerald-400 size-4" />
														<span>{item.title}</span>
													</a>
												</li>
											))}
										</ul>
									</div>
								</NavigationMenuContent>
							</NavigationMenuItem>
						</NavigationMenuList>
					</NavigationMenu>
				</div>
				
				<div className="hidden items-center gap-3 md:flex">
					{isSignedIn ? (
						<div className="flex items-center gap-3">
							<span className="text-xs text-slate-400 font-mono hidden lg:inline">{userEmail}</span>
							<Button variant="outline" size="sm" onClick={onSignOut} className="text-xs border-slate-750 text-slate-300 cursor-pointer hover:bg-slate-800">
								Sign Out
							</Button>
						</div>
					) : (
						<Button variant="outline" size="sm" onClick={onSignInClick} className="text-xs border-slate-750 text-slate-300 cursor-pointer hover:bg-slate-800">
							Sign In / Clinician Access
						</Button>
					)}
					<Button size="sm" onClick={() => onTabChange?.('diabetes')} className="text-xs bg-[#10b981] hover:bg-[#34d399] text-black font-semibold cursor-pointer">
						Test Predictor
					</Button>
				</div>

				<Button
					size="icon"
					variant="outline"
					onClick={() => setOpen(!open)}
					className="md:hidden border-slate-800"
					aria-expanded={open}
					aria-controls="mobile-menu"
					aria-label="Toggle menu"
				>
					<MenuToggleIcon open={open} className="size-5 text-slate-200" duration={300} />
				</Button>
			</nav>

			<MobileMenu open={open} className="flex flex-col justify-between gap-4 overflow-y-auto bg-[#0a0b0e]">
				<NavigationMenu className="max-w-full">
					<div className="flex w-full flex-col gap-y-3 px-4 bg-[#0a0b0e]">
						<span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mt-4">Predictors & Analytics</span>
						{productLinks.map((link) => (
							<ListItem 
								key={link.title} 
								{...link} 
								onClick={(e) => handleLinkClick(e, link.tabId)} 
								data-active={activeTab === link.tabId}
							/>
						))}
						
						<span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mt-4">Information & Docs</span>
						{companyLinks.map((link) => (
							<ListItem 
								key={link.title} 
								{...link} 
								onClick={(e) => handleLinkClick(e, link.tabId)}
								data-active={activeTab === link.tabId}
							/>
						))}
					</div>
				</NavigationMenu>
				
				<div className="flex flex-col gap-2 p-4 border-t border-slate-800 bg-[#0a0b0e]">
					{isSignedIn ? (
						<div className="space-y-2">
							<p className="text-xs font-mono text-slate-500 text-center">{userEmail}</p>
							<Button variant="outline" className="w-full text-xs text-slate-300 border-slate-800 hover:bg-slate-900" onClick={onSignOut}>
								Sign Out
							</Button>
						</div>
					) : (
						<Button variant="outline" className="w-full text-xs text-slate-300 border-slate-800 hover:bg-slate-900 bg-transparent" onClick={onSignInClick}>
							Sign In / Clinician Access
						</Button>
					)}
					<Button className="w-full text-xs bg-[#10b981] hover:bg-[#34d399] text-black font-semibold" onClick={() => { onTabChange?.('diabetes'); setOpen(false); }}>
						Test Predictor
					</Button>
				</div>
			</MobileMenu>
		</header>
	);
}

type MobileMenuProps = React.ComponentProps<'div'> & {
	open: boolean;
};

function MobileMenu({ open, children, className, ...props }: MobileMenuProps) {
	if (!open || typeof window === 'undefined') return null;

	return createPortal(
		<div
			id="mobile-menu"
			className={cn(
				'bg-[#0a0b0e]/95 backdrop-blur-lg border-b border-slate-800',
				'fixed top-14 right-0 bottom-0 left-0 z-40 flex flex-col overflow-hidden md:hidden',
			)}
		>
			<div
				data-slot={open ? 'open' : 'closed'}
				className={cn(
					'data-[slot=open]:animate-in data-[slot=open]:zoom-in-97 ease-out',
					'size-full bg-[#0a0b0e]',
					className,
				)}
				{...props}
			>
				{children}
			</div>
		</div>,
		document.body,
	);
}

function ListItem({
	title,
	description,
	icon: Icon,
	className,
	onClick,
	...props
}: React.ComponentProps<typeof NavigationMenuLink> & LinkItem) {
	return (
		<NavigationMenuLink 
			className={cn(
				'w-full flex flex-row gap-x-3 items-center hover:bg-slate-900 rounded-xl p-2.5 transition-colors no-underline cursor-pointer', 
				'data-[active=true]:bg-emerald-500/10 data-[active=true]:text-emerald-400',
				className
			)} 
			{...props} 
			onClick={onClick}
			asChild
		>
			<a href="#" className="flex items-center gap-x-3">
				<div className="bg-[#0f1116] flex aspect-square size-10 items-center justify-center rounded-lg border border-slate-800 shadow-sm">
					<Icon className="text-emerald-400 size-5" />
				</div>
				<div className="flex flex-col items-start justify-center">
					<span className="font-semibold text-xs text-slate-200">{title}</span>
					<span className="text-slate-400 text-[10px] m-0">{description}</span>
				</div>
			</a>
		</NavigationMenuLink>
	);
}

const productLinks: LinkItem[] = [
	{
		title: 'Diabetes Risk Predictor',
		tabId: 'diabetes',
		description: 'Clinical glucose, BMI & metabolic analysis.',
		icon: Activity,
	},
	{
		title: 'Heart Disease Predictor',
		tabId: 'heart',
		description: 'ECG anomalies, lipid profiling & heart risk.',
		icon: Heart,
	},
	{
		title: 'Symptom AI Clinician',
		tabId: 'symptoms',
		description: 'NLP symptom diagnostic checker simulation.',
		icon: Sliders,
	},
	{
		title: 'SHAP Interpretability',
		tabId: 'shap',
		description: 'Visual patient parameter feature importance.',
		icon: BarChart,
	},
	{
		title: 'Data Drift & Insights',
		tabId: 'drift',
		description: 'MLOps dataset statistical checks over time.',
		icon: TrendingUp,
	},
];

const companyLinks: LinkItem[] = [
	{
		title: 'About Clinical Project',
		tabId: 'dashboard',
		description: 'Explore the workspace research and goals.',
		icon: BookOpen,
	},
];

const companyLinks2 = [
	{
		title: 'Launch Diabetes Hub',
		tabId: 'diabetes',
		icon: Activity,
	},
	{
		title: 'Launch Cardiac Hub',
		tabId: 'heart',
		icon: Heart,
	},
];


function useScroll(threshold: number) {
	const [scrolled, setScrolled] = React.useState(false);

	const onScroll = React.useCallback(() => {
		setScrolled(window.scrollY > threshold);
	}, [threshold]);

	React.useEffect(() => {
		window.addEventListener('scroll', onScroll);
		return () => window.removeEventListener('scroll', onScroll);
	}, [onScroll]);

	React.useEffect(() => {
		onScroll();
	}, [onScroll]);

	return scrolled;
}
