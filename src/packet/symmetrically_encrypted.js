// GPG4Browsers - An OpenPGP implementation in javascript
// Copyright (C) 2011 Recurity Labs GmbH
// 
// This library is free software; you can redistribute it and/or
// modify it under the terms of the GNU Lesser General Public
// License as published by the Free Software Foundation; either
// version 2.1 of the License, or (at your option) any later version.
// 
// This library is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// Lesser General Public License for more details.
// 
// You should have received a copy of the GNU Lesser General Public
// License along with this library; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301  USA

var crypto = require('../crypto');

/**
 * @class
 * @classdesc Implementation of the Symmetrically Encrypted Data Packet (Tag 9)
 * 
 * RFC4880 5.7: The Symmetrically Encrypted Data packet contains data encrypted
 * with a symmetric-key algorithm. When it has been decrypted, it contains other
 * packets (usually a literal data packet or compressed data packet, but in
 * theory other Symmetrically Encrypted Data packets or sequences of packets
 * that form whole OpenPGP messages).
 */

module.exports = function packet_symmetrically_encrypted() {
  this.encrypted = null;
  /** Decrypted packets contained within. 
   * @type {openpgp_packetlist} */
  this.packets;

  this.read = function(bytes) {
    this.encrypted = bytes;
  }

  this.write = function() {
    return this.encrypted;
  }

  /**
   * Symmetrically decrypt the packet data
   * 
   * @param {Integer} sessionKeyAlgorithm
   *             Symmetric key algorithm to use // See RFC4880 9.2
   * @param {String} key
   *             Key as string with the corresponding length to the
   *            algorithm
   * @return The decrypted data;
   */
  this.decrypt = function(sessionKeyAlgorithm, key) {
    var decrypted = crypto.cfb.decrypt(
      sessionKeyAlgorithm, key, this.encrypted, true);

    this.packets.read(decrypted);
  }

  this.encrypt = function(algo, key) {
    var data = this.packets.write();

    this.encrypted = crypto.cfb.encrypt(
      crypto.getPrefixRandom(algo), algo, data, key, true);
  }
};