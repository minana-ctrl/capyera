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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-lg border">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary">Capyera Inventory</h1>
          <p className="text-muted-foreground mt-2">Sign in to manage your inventory</p>
        </div>
        <Auth
          supabaseClient={supabase}
          appearance={{ 
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: 'hsl(217, 91%, 60%)',
                  brandAccent: 'hsl(217, 91%, 50%)',
                }
              }
            }
          }}
          theme="light"
          providers={[]}
        />
      </div>
    </div>
  );
};

export default Login;
