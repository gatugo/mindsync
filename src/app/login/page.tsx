'use client';

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
    const router = useRouter();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                router.replace('/');
            }
        };
        checkUser();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
                router.replace('/');
            }
        });

        return () => subscription.unsubscribe();
    }, [router]);

    if (!isMounted) return null;

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 text-transparent bg-clip-text mb-2">
                        MindSync
                    </h1>
                    <p className="text-slate-400">Sync your mind. Find your flow.</p>
                </div>

                <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
                    <Auth
                        supabaseClient={supabase}
                        appearance={{
                            theme: ThemeSupa,
                            variables: {
                                default: {
                                    colors: {
                                        brand: '#6366f1',
                                        brandAccent: '#4f46e5',
                                        inputBackground: '#1e293b',
                                        inputText: '#f8fafc',
                                        inputBorder: '#334155',
                                        inputPlaceholder: '#64748b',
                                    }
                                }
                            },
                        }}
                        theme="dark"
                        providers={[]} // Add 'google', 'github' later if needed
                        magicLink={true}
                    />
                </div>

                <div className="mt-8 text-center">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Guest Mode
                    </Link>
                </div>
            </div>
        </div>
    );
}
