export default function WidgetLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <title>Chat Widget</title>
        <style>{`
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; }
        `}</style>
      </head>
      <body style={{
        margin: 0,
        padding: 0,
        backgroundColor: 'transparent',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        {children}
      </body>
    </html>
  )
}