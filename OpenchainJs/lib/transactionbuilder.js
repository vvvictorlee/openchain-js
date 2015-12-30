﻿"use strict";

var Schema = require("./schema");
var ApiClient = require("./apiclient");
var encoding = require("./encoding");
var ByteBuffer = Schema.ByteBuffer;

function TransactionBuilder(apiClient) {
    
    if (apiClient.namespace === null) {
        throw new Error("The API client has not been initialized");
    }
    
    this.client = apiClient;
    this.records = [];
    this.metadata = ByteBuffer.fromHex("");
};

TransactionBuilder.prototype.addRecord = function (key, value, version) {
    var newRecord = {
        "key": key,
        "version": version
    };
    
    if (value != null) {
        newRecord["value"] = { "data": value };
    }
    else {
        newRecord["value"] = null;
    }
    
    this.records.push(newRecord);
    
    return this;
};

TransactionBuilder.prototype.setMetadata = function (data) {
    this.metadata = encoding.encodeString(JSON.stringify(data));
};

TransactionBuilder.prototype.addAccountRecord = function (previous, change) {
    return this.addRecord(
        previous.key,
        encoding.encodeInt64(previous.balance.add(change)),
        previous.version);
};

TransactionBuilder.prototype.updateAccountRecord = function (account, asset, delta) {
    // Resolve name accounts
    if (account.slice(0, 1) == "@") {
        account = "/aka/" + account.slice(1, account.length) + "/";
    }
    
    var _this = this;

    return this.client.getDataRecord(account, "goto").then(function (result) {
        if (result.data == null) {
            return account;
        }
        else {
            // If a goto DATA record exists, we use the redirected path
            _this.addRecord(result.key, null, result.version);
            return result.data;
        }
    }).then(function (accountResult) {
        return _this.client.getAccountRecord(accountResult, asset);
    }).then(function (currentRecord) {
        _this.addAccountRecord(currentRecord, delta);
    });
};

TransactionBuilder.prototype.build = function () {
    var constructedTransaction = new Schema.Mutation({
        "namespace": this.client.namespace,
        "records": this.records,
        "metadata": this.metadata
    });
    
    return constructedTransaction.encode();
};

module.exports = TransactionBuilder;