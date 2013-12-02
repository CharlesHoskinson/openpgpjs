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

var packet = require('./packet');
var enums = require('./enums.js');
var armor = require('./encoding/armor.js');
var config = require('./config');

/**
 * @class
 * @classdesc Class that represents an OpenPGP key. Must contain a primary key.
 * Can contain additional subkeys, signatures, user ids, user attributes.
 * @param  {packetlist} packetlist The packets that form this key
 */

function Key(packetlist) {
  if (!(this instanceof Key)) {
    return new Key(packetlist);
  }
  this.packets = packetlist || new packet.list();
}

/** 
 * Returns the primary key packet (secret or public)
 * @returns {packet_secret_key|packet_public_key|null} 
 */
Key.prototype.getKeyPacket = function() {
  for (var i = 0; i < this.packets.length; i++) {
    if (this.packets[i].tag == enums.packet.public_key ||
      this.packets[i].tag == enums.packet.secret_key) {
      return this.packets[i];
    }
  }
  return null;
};

/** 
 * Returns all the private and public subkey packets
 * @returns {[public_subkey|secret_subkey]} 
 */
Key.prototype.getSubkeyPackets = function() {

  var subkeys = [];

  for (var i = 0; i < this.packets.length; i++) {
    if (this.packets[i].tag == enums.packet.public_subkey ||
      this.packets[i].tag == enums.packet.secret_subkey) {
      subkeys.push(this.packets[i]);
    }
  }

  return subkeys;
};

/** 
 * Returns all the private and public key and subkey packets
 * @returns {[public_subkey|secret_subkey|packet_secret_key|packet_public_key]} 
 */
Key.prototype.getAllKeyPackets = function() {
  return [this.getKeyPacket()].concat(this.getSubkeyPackets());
};

/** 
 * Returns key IDs of all key packets
 * @returns {[keyid]} 
 */
Key.prototype.getKeyIds = function() {
  var keyIds = [];
  var keys = this.getAllKeyPackets();
  for (var i = 0; i < keys.length; i++) {
    keyIds.push(keys[i].getKeyId());
  }
  return keyIds;
};

function findKey(keys, keyIds) {
  for (var i = 0; i < keys.length; i++) {
    var keyId = keys[i].getKeyId(); 
    for (var j = 0; j < keyIds.length; j++) {
      if (keyId.equals(keyIds[j])) {
        return keys[i];
      }
    }
  }
  return null;
}

/**
 * Returns first public key packet for given array of key IDs
 * @param  {[keyid]} keyIds 
 * @return {public_subkey|packet_public_key|null}       
 */
Key.prototype.getPublicKeyPacket = function(keyIds) {
  var keys = this.packets.filterByTag(enums.packet.public_key, enums.packet.public_subkey);
  return findKey(keys, keyIds);
};

/**
 * Returns first private key packet for given array of key IDs
 * @param  {[keyid]} keyIds
 * @return {secret_subkey|packet_secret_key|null}       
 */
Key.prototype.getPrivateKeyPacket = function(keyIds) {
  var keys = this.packets.filterByTag(enums.packet.secret_key, enums.packet.secret_subkey);
  return findKey(keys, keyIds);
};

/**
 * Returns true if this is a public key
 * @return {Boolean}
 */
Key.prototype.isPublic = function() {
  var publicKeyPackets = this.packets.filterByTag(enums.packet.public_key);
  return publicKeyPackets.length ? true : false;
};

/**
 * Returns true if this is a private key
 * @return {Boolean}
 */
Key.prototype.isPrivate = function() {
  var privateKeyPackets = this.packets.filterByTag(enums.packet.private_key);
  return privateKeyPackets.length ? true : false;
};

/**
 * Returns key as public key
 * @return {key} public key
 */
Key.prototype.toPublic = function() {
  for (var i = 0; i < this.packets.length; i++) {
    if (this.packets[i].tag == enums.packet.secret_key) {
      var bytes = this.packets[i].writePublicKey();
      var pubKeyPacket = new packet.public_key();
      pubKeyPacket.read(bytes);
      this.packets[i] = pubKeyPacket;
    }
    if (this.packets[i].tag == enums.packet.secret_subkey) {
      var bytes = this.packets[i].writePublicKey();
      var pubSubkeyPacket = new packet.public_subkey();
      pubSubkeyPacket.read(bytes);
      this.packets[i] = pubSubkeyPacket;
    }
  }
  return this;
};

/**
 * Returns ASCII armored text of key
 * @return {String} ASCII armor
 */
Key.prototype.armor = function() {
  var type = this.isPublic() ? enums.armor.public_key : enums.armor.private_key;
  return armor.encode(type, this.packets.write());
};

/**
 * Returns first key packet that is available for signing
 * @return {public_subkey|secret_subkey|packet_secret_key|packet_public_key|null}
 */
Key.prototype.getSigningKeyPacket = function() {

  var signing = [ enums.publicKey.rsa_encrypt_sign, enums.publicKey.rsa_sign, enums.publicKey.dsa];

  signing = signing.map(function(s) {
    return enums.read(enums.publicKey, s);
  });

  var keys = this.getAllKeyPackets();

  for (var i = 0; i < keys.length; i++) {
    if (signing.indexOf(keys[i].algorithm) !== -1) {
      return keys[i];
    }
  }

  return null;
};

/**
 * Returns preferred signature hash algorithm of this key
 * @return {String}
 */
Key.prototype.getPreferredSignatureHashAlgorithm = function() {
  //TODO implement: https://tools.ietf.org/html/rfc4880#section-5.2.3.8
  //separate private key preference from digest preferences
  return config.prefer_hash_algorithm;
};

/**
 * Returns the first valid encryption key packet for this key
 * @returns {public_subkey|secret_subkey|packet_secret_key|packet_public_key|null} key packet or null if no encryption key has been found
 */
Key.prototype.getEncryptionKeyPacket = function() {
  // V4: by convention subkeys are prefered for encryption service
  // V3: keys MUST NOT have subkeys
  var isValidEncryptionKey = function(key) {
    //TODO evaluate key flags: http://tools.ietf.org/html/rfc4880#section-5.2.3.21
    return key.algorithm != enums.read(enums.publicKey, enums.publicKey.dsa) && key.algorithm != enums.read(enums.publicKey,
      enums.publicKey.rsa_sign);
    //TODO verify key
    //&& keys.verifyKey()
  };

  var subkeys = this.getSubkeyPackets();

  for (var j = 0; j < subkeys.length; j++) {
    if (isValidEncryptionKey(subkeys[j])) {
      return subkeys[j];
    }
  }
  // if no valid subkey for encryption, use primary key
  var primaryKey = this.getKeyPacket();
  if (isValidEncryptionKey(primaryKey)) {
    return primaryKey;
  }
  return null;
};

/**
 * Decrypts all secret key and subkey packets
 * @param  {String} passphrase 
 * @return {Boolean} true if all key and subkey packets decrypted successfully
 */
Key.prototype.decrypt = function(passphrase) {
  var keys = this.packets.filterByTag(enums.packet.secret_key, enums.packet.secret_subkey);
  for (var i = 0; i < keys.length; i++) {
    var success = keys[i].decrypt(passphrase);
    if (!success) return false;
  }
  return true;
};

/**
 * Decrypts specific key packets by key ID
 * @param  {[keyid]} keyIds
 * @param  {String} passphrase 
 * @return {Boolean} true if all key packets decrypted successfully
 */
Key.prototype.decryptKeyPacket = function(keyIds, passphrase) {
  //TODO return value
  var keys = this.packets.filterByTag(enums.packet.secret_key, enums.packet.secret_subkey);
  for (var i = 0; i < keys.length; i++) {
    var keyId = keys[i].getKeyId(); 
    for (var j = 0; j < keyIds.length; j++) {
      if (keyId.equals(keyIds[j])) {
        var success = keys[i].decrypt(passphrase);
        if (!success) return false;
      }
    }
  }
  return true;
};

// TODO
Key.prototype.verify = function() {

};
// TODO
Key.prototype.revoke = function() {

};


/**
 * reads an OpenPGP armored text and returns a key object
 * @param {String} armoredText text to be parsed
 * @return {key} new key object
 */
function readArmored(armoredText) {
  //TODO how do we want to handle bad text? Exception throwing
  //TODO don't accept non-key armored texts
  var input = armor.decode(armoredText).data;
  var packetlist = new packet.list();
  packetlist.read(input);
  var newKey = new Key(packetlist);
  return newKey;
}

exports.Key = Key;
exports.readArmored = readArmored;