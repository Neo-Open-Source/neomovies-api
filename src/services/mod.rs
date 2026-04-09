pub mod neoid;
pub mod cdn;
pub mod kinopoisk;
pub mod players;
pub mod torrents;

pub use neoid::NeoIdClient;
pub use kinopoisk::KinopoiskClient;
pub use torrents::JacredClient;
pub use players::{
    get_alloha_player,
    get_lumex_player,
    get_vibix_player,
    get_hdvb_player,
    get_collaps_player,
};
