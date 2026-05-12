import SideNav from '@/app/ui/dashboard/sidenav';

// Enable Partial Prerendering for /dashboard/* once you've switched to
// next@canary and uncommented `experimental.ppr` in next.config.ts.
// export const experimental_ppr = true;

// All dashboard routes hit Supabase per request — no point in
// statically prerendering them, and it lets `npm run build` succeed
// without a live DB connection.
export const dynamic = 'force-dynamic';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col md:flex-row md:overflow-hidden">
      <div className="w-full flex-none md:w-64">
        <SideNav />
      </div>
      <div className="flex-grow p-6 md:overflow-y-auto md:p-12">
        {children}
      </div>
    </div>
  );
}
