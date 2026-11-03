// site/brand/streams.js
// Retransmisión principal y lista de reproducción de la TEMPORADA VIVA (2026).
//
// Son constantes de marca porque no tienen fuente en data/raw/: la lista de
// reproducción es la misma todo el evento y cada día de retransmisión principal se
// anuncia una vez. Los streams POR CAMPO no están aquí: cambian cada día y viven en
// data/raw/manual/streams/{year}.json, que es lo que el GameDay lee ya procesado
// (data/processed/{year}/streams.json → `ST` en site/templates/data.js).
// Las temporadas archivadas no usan este archivo: su GameDay sale de playlists.json.

export const LIVE_STREAMS = {
  playlist: 'https://www.youtube.com/playlist?list=PLU01kG-VN6qw',
  general: [
    { key: 'day1', day: 1, label: 'Day 1', id: '2giQLSlMOgo', url: 'https://www.youtube.com/watch?v=2giQLSlMOgo' },
    { key: 'day2', day: 2, label: 'Day 2', id: 'UekLwTOuNUU', url: 'https://www.youtube.com/watch?v=UekLwTOuNUU' },
    { key: 'day3', day: 3, label: 'Day 3', id: 'juiOD0SCK9Q', url: 'https://www.youtube.com/watch?v=juiOD0SCK9Q' },
  ],
};
