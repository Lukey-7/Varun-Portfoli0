import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Index from "./pages/Index";
import Nexus from "./pages/Nexus";
import Vault from "./pages/Vault";
import Terminal from "./pages/Terminal";
import NotFound from "./pages/NotFound";
import Navigation from "./components/Navigation";
import CustomCursor from "./components/CustomCursor";
import NebulaBackground from "./components/NebulaBackground";
import NoiseOverlay from "./components/NoiseOverlay";

const queryClient = new QueryClient();

const AnimatedRoutes = () => {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Index />} />
        <Route path="/nexus" element={<Nexus />} />
        <Route path="/vault" element={<Vault />} />
        <Route path="/terminal" element={<Terminal />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <NebulaBackground />
        <NoiseOverlay />
        <CustomCursor />
        <Navigation />
        <AnimatedRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
