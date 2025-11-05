import React, { useState } from 'react';
import Head from 'next/head';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import { resolveAppOrigin } from '@/utils/app-origin';

const CustomHead = () => {
    const siteTitle = 'meal.it | Smart Nutrition Analysis';
    const description = 'Professional nutrition tracking with AI-powered food analysis. Track macros, analyze meals, and achieve your health goals efficiently.';
    const pageImage = 'https://aicc.gptdevelopment.online/cor.webp';
    const keywords = 'nutrition analysis, food tracking, macro counting, meal analysis, health goals, meal.it, smart nutrition, professional nutrition';
    const appOrigin = resolveAppOrigin();
    const canonicalUrl = `${appOrigin}/`;


    return (
        <Head>
            <title>{siteTitle}</title>
            <meta name="description" content={description}/>
            <meta property="og:title" content={siteTitle}/>
            <meta name="twitter:title" content={siteTitle}/>
            <meta itemProp="name" content={siteTitle}/>
            <link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
            <link rel="shortcut icon" href="/favicon.svg" type="image/svg+xml"/>
            <meta name="keywords" content={keywords}/>
            <meta name="application-name" content={siteTitle}/>
            <meta property="og:description" content={description}/>
            <meta property="og:site_name" content={siteTitle}/>
            <meta property="og:url" content={canonicalUrl}/>
            <meta property="og:locale" content="en_US"/>
            <meta property="og:image" content={pageImage}/>
            <meta property="og:image:secure_url" content={pageImage}/>
            <meta property="og:type" content="website"/>
            <meta name="twitter:card" content={siteTitle}/>
            <meta name="twitter:site" content={canonicalUrl}/>
            <meta name="twitter:image" content={pageImage}/>
            <meta name="twitter:description" content={description}/>
        </Head>
    )
}


export const Header = () => {
    const { user, profile, signOut, loading, isAuthenticated } = useAuth();
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authMode, setAuthMode] = useState('signin');

    const handleSignOut = async () => {
        await signOut();
    };

    const openAuthModal = (mode = 'signin') => {
        setAuthMode(mode);
        setShowAuthModal(true);
    };

    return (
        <div>
            <CustomHead/>
            <header className="bg-base-100 shadow-lg">
                <div className="container mx-auto flex justify-between items-center p-5">
                    {/* Brand Section */}
                    <div className="flex items-center">
                        <span className="text-2xl font-semibold text-yellow-600">meal.it</span>
                    </div>

                    {/* Navigation Menu */}
                    <nav className="flex items-center space-x-4">
                        {loading ? (
                            <div className="animate-pulse bg-gray-200 h-8 w-20 rounded"></div>
                        ) : isAuthenticated ? (
                            <div className="flex items-center space-x-4">
                                {/* User Info */}
                                <div className="hidden md:flex items-center space-x-2">
                                    <span className="text-sm text-gray-600">Welcome,</span>
                                    <span className="text-sm font-semibold text-gray-800">
                                        {profile?.display_name || user?.email?.split('@')[0] || 'User'}
                                    </span>
                                </div>

                                {/* Sign Out Button */}
                                <button
                                    onClick={handleSignOut}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
                                >
                                    Sign Out
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center space-x-3">
                                {/* Sign In Button */}
                                <button
                                    onClick={() => openAuthModal('signin')}
                                    className="text-gray-700 hover:text-yellow-600 px-3 py-2 text-sm font-medium transition-colors duration-200"
                                >
                                    Sign In
                                </button>

                                {/* Sign Up Button */}
                                <button
                                    onClick={() => openAuthModal('signup')}
                                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
                                >
                                    Get Started
                                </button>
                            </div>
                        )}
                    </nav>

                </div>
            </header>

            {/* Auth Modal */}
            <AuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                mode={authMode}
            />
        </div>
    );
};
