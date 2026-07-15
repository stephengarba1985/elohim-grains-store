export default function RiderCard({ rider }) {
  if (!rider) return null;

  return (
    <div className="bg-white p-4 rounded-xl shadow flex items-center gap-4">
      <img
        src={rider.avatar || "/rider.png"}
        alt="Rider"
        className="w-14 h-14 rounded-full"
      />

      <div>
        <h3 className="font-bold">{rider.name}</h3>
        <p className="text-sm text-gray-500">{rider.phone}</p>
      </div>

      <a
        href={`tel:${rider.phone}`}
        className="ml-auto bg-green-500 text-white px-4 py-2 rounded-lg"
      >
        Call
      </a>
    </div>
  );
}