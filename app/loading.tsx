export default function Loading() {
  return (
    <div className="flex h-screen bg-[var(--surface-0,#0f0f0f)]">
      {/* Sidebar skeleton */}
      <div className="w-64 border-r border-[var(--border-subtle,#2a2a2a)] p-4 space-y-3">
        <div className="h-10 bg-[var(--surface-1,#1a1a1a)] rounded animate-pulse" />
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-12 bg-[var(--surface-1,#1a1a1a)] rounded animate-pulse" />
          ))}
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-16 border-b border-[var(--border-subtle,#2a2a2a)] px-6 flex items-center gap-4">
          <div className="h-8 w-48 bg-[var(--surface-1,#1a1a1a)] rounded animate-pulse" />
          <div className="h-8 w-32 bg-[var(--surface-1,#1a1a1a)] rounded animate-pulse ml-auto" />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-3">
              {/* User message */}
              <div className="flex justify-end">
                <div className="max-w-[70%] space-y-2">
                  <div className="h-4 w-24 bg-[var(--surface-1,#1a1a1a)] rounded animate-pulse ml-auto" />
                  <div className="h-20 bg-[var(--surface-1,#1a1a1a)] rounded animate-pulse" />
                </div>
              </div>
              
              {/* Assistant message */}
              <div className="flex justify-start">
                <div className="max-w-[70%] space-y-2">
                  <div className="h-4 w-32 bg-[var(--surface-1,#1a1a1a)] rounded animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-4 bg-[var(--surface-1,#1a1a1a)] rounded animate-pulse" />
                    <div className="h-4 bg-[var(--surface-1,#1a1a1a)] rounded animate-pulse w-5/6" />
                    <div className="h-4 bg-[var(--surface-1,#1a1a1a)] rounded animate-pulse w-4/6" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input skeleton */}
        <div className="border-t border-[var(--border-subtle,#2a2a2a)] p-4">
          <div className="h-24 bg-[var(--surface-1,#1a1a1a)] rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
