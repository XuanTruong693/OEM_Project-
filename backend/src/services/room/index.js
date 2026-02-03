const { TokenService, tokenService, signRoomToken, verifyRoomToken } = require("./TokenService");
const { RoomVerificationService, roomVerificationService } = require("./RoomVerificationService");

module.exports = {
    // Classes
    TokenService,
    RoomVerificationService,

    // Singleton instances
    tokenService,
    roomVerificationService,

    // Backward-compatible functions
    signRoomToken,
    verifyRoomToken,
};
