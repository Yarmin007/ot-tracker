/**
 * Grey placeholder shapes shown while a screen loads, in roughly the layout
 * that's coming (feels faster than a blank screen with a spinner). They only
 * appear after a short moment, so quick loads don't flash.
 */
const Bar = ({ className = '' }: { className?: string }) => <div className={`rounded-lg bg-gray-200/80 ${className}`} />;

function Frame({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <main className={`w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-[fade-in-late_.6s_ease-out_both] ${className}`} role="status" aria-live="polite">
      <div className="animate-pulse">{children}</div>
      <span className="sr-only">Loading…</span>
    </main>
  );
}

const Card = ({ children, className = "" }: { children?: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm ${className}`}>{children}</div>
);

export function DashboardSkeleton() {
  return (
    <Frame className="max-w-[1600px] lg:px-8">
      <Card className="mb-6 overflow-hidden">
        <div className="flex items-center gap-2 p-3 sm:p-4 border-b border-gray-100 bg-gray-50/60">
          <Bar className="w-10 h-10 rounded-xl" />
          <Bar className="flex-1 h-12 rounded-xl" />
          <Bar className="w-10 h-10 rounded-xl" />
        </div>
        <div className="p-4 sm:p-6 space-y-4">
          <Bar className="w-32 h-4" />
          <Bar className="w-44 h-12" />
          <div className="grid grid-cols-2 gap-2 max-w-xs">
            <Bar className="h-14 rounded-xl" />
            <Bar className="h-14 rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:max-w-md">
            <Bar className="h-12 rounded-xl" />
            <Bar className="h-12 rounded-xl" />
          </div>
        </div>
      </Card>
      <Bar className="w-40 h-6 mb-3" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="p-4">
            <div className="flex items-start gap-3">
              <Bar className="w-12 h-14 rounded-xl" />
              <div className="flex-1 space-y-2 pt-1">
                <Bar className="w-24 h-3.5" />
                <Bar className="w-full h-4" />
              </div>
              <Bar className="w-14 h-6" />
            </div>
            <div className="mt-3 flex gap-2">
              <Bar className="w-24 h-7" />
              <Bar className="w-24 h-7" />
            </div>
          </Card>
        ))}
      </div>
    </Frame>
  );
}

export function ListSkeleton() {
  return (
    <Frame className="max-w-4xl">
      <Bar className="w-48 h-8 mb-2" />
      <Bar className="w-64 h-4 mb-6" />
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-4 sm:p-5 flex items-center gap-3">
            <Bar className="w-11 h-11 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Bar className="w-40 h-4" />
              <Bar className="w-28 h-3.5" />
            </div>
            <Bar className="hidden sm:block w-28 h-10 rounded-xl" />
          </Card>
        ))}
      </div>
    </Frame>
  );
}

export function SettingsSkeleton() {
  return (
    <Frame className="max-w-2xl">
      <Bar className="w-40 h-8 mb-2" />
      <Bar className="w-56 h-4 mb-6" />
      <div className="space-y-4">
        <Card className="h-20" />
        <Card className="p-5 space-y-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Bar className="w-28 h-4" />
              <Bar className="w-full h-12 rounded-xl" />
            </div>
          ))}
        </Card>
      </div>
    </Frame>
  );
}
