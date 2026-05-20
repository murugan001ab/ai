export default function Live() {
  const cameras = [
    {
      name: "Front Office",
      url: "http://192.168.0.122:8889/cam1",
    },
    {
      name: "Lobby",
      url: "http://192.168.0.122:8889/cam2",
    },
    {
      name: "Parking",
      url: "http://192.168.0.122:8889/cam3",
    },
    {
      name: "Warehouse",
      url: "http://192.168.0.122:8889/cam4",
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        padding: "20px",
        boxSizing: "border-box",
      }}
    >
      <h1
        style={{
          color: "white",
          fontSize: "32px",
          fontWeight: "bold",
          marginBottom: "24px",
        }}
      >
        CCTV Live Dashboard
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(500px, 1fr))",
          gap: "20px",
        }}
      >
        {cameras.map((camera) => (
          <div
            key={camera.name}
            style={{
              background: "#111827",
              borderRadius: "16px",
              overflow: "hidden",
              border: "1px solid #1e293b",
              boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                color: "white",
                fontSize: "18px",
                fontWeight: "600",
                borderBottom: "1px solid #1e293b",
              }}
            >
              {camera.name}
            </div>

            <iframe
              src={camera.url}
              title={camera.name}
              allow="autoplay; fullscreen"
              allowFullScreen
              style={{
                width: "100%",
                height: "320px",
                border: "none",
                background: "black",
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}