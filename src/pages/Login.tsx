import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

const Login = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-background/95 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>
      
      <div className="w-full max-w-md p-8 space-y-6 glass-strong rounded-2xl shadow-2xl border-2 border-border/50 relative z-10 hover-lift">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold gradient-text">Capyera Inventory</h1>
          <p className="text-muted-foreground text-sm">Sign in to manage your inventory</p>
        </div>
        <Auth
          supabaseClient={supabase}
          appearance={{ 
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: 'hsl(250, 95%, 63%)',
                  brandAccent: 'hsl(190, 95%, 50%)',
                }
              }
            }
          }}
          theme="dark"
          providers={[]}
        />
      </div>
    </div>
  );
};

export default Login;
