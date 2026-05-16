'use client';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; background: #0f0f0f; color: #e8e4dc; font-family: 'DM Sans', sans-serif; }
      `}</style>
            <div style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center',
                justifyContent: 'center', background: '#0f0f0f',
            }}>
                <div style={{
                    background: '#141414', border: '1px solid #1e1e1e',
                    borderRadius: 16, padding: '48px 40px', width: '100%',
                    maxWidth: 380, textAlign: 'center',
                }}>
                    <div style={{
                        fontFamily: 'Instrument Serif, serif', fontSize: 36,
                        color: '#2a2a2a', marginBottom: 12,
                    }}>✦</div>
                    <h1 style={{
                        fontFamily: 'Instrument Serif, serif', fontSize: 26,
                        color: '#e8e4dc', marginBottom: 8, fontWeight: 400,
                    }}>Welcome to AI Real</h1>
                    <p style={{ fontSize: 13, color: '#555', marginBottom: 36, lineHeight: 1.6 }}>
                        Sign in to start chatting and save your history
                    </p>

                    <button
                        onClick={() => signIn('google', { callbackUrl: '/' })}
                        style={{
                            width: '100%', padding: '12px 20px',
                            background: '#1a1a1a', border: '1px solid #2e2e2e',
                            borderRadius: 10, color: '#e8e4dc', fontSize: 14,
                            fontFamily: 'DM Sans, sans-serif', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: 10, transition: 'all 0.15s',
                        }}
                        onMouseOver={e => (e.currentTarget.style.background = '#222')}
                        onMouseOut={e => (e.currentTarget.style.background = '#1a1a1a')}
                    >
                        <svg width="18" height="18" viewBox="0 0 18 18">
                            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
                            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
                            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
                            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
                        </svg>
                        Continue with Google
                    </button>
                </div>
            </div>
        </>
    );
}