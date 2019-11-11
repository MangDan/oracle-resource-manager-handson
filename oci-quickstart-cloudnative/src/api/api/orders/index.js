/**
 * Copyright © 2019, Oracle and/or its affiliates. All rights reserved.
 * The Universal Permissive License (UPL), Version 1.0
 */
(function (){
  'use strict';

  const axios = require("axios")
    , express   = require("express")
    , endpoints = require("../endpoints")
    , common    = require("../common")
    , helpers   = require("../../helpers")
    , app       = express.Router()

  app.get("/orders", function (req, res, next) {

    if (!helpers.isLoggedIn(req)) {
      return next(helpers.createError("User not logged in", 401));
    }

    const custId = helpers.getCustomerId(req);
    const { sort = 'orderDate,desc' } = req.query;
    const url = endpoints.ordersUrl + `/orders/search/customer?custId=${custId}&sort=${sort}`;
    axios.get(url)
      .then(({ status, data }) => res.status(status).json(data._embedded.customerOrders))
      .catch(err => {
        const { response } = err;
        if (response && response.status === 404) {
          return res.json([]);
        } else {
          next(err);
        }
      });
  });

  app.get("/orders/*", function (req, res, next) {
    axios.get(endpoints.ordersUrl + req.url.toString())
      .then(({ data }) => res.json(data))
      .catch(next);
  });

  app.post("/orders", async function(req, res, next) {
    if (!helpers.isLoggedIn(req)) {
      return next(helpers.createError("User not logged in.", 401));
    }

    const cartId = helpers.getCartId(req);

    try {
      // load customer & links
      const user = await common.getCustomer(req);
      const { _links: { customer, addresses, cards }} = user;

      // resolve user address/payment card
      const [ address, card ] = await Promise.all([
        { link: addresses, key: 'address' },
        { link: cards, key: 'card' },
      ].map(ref => {
        // resolve each to a single result (_links.self)
        return axios.get(ref.link.href)
          .then(({ data }) => data._embedded && data._embedded[ref.key])
          .then(list => list && list.length && list.pop()._links.self);
      }));

      // place order & respond
      const order = {
        items: `${endpoints.cartsUrl}/${cartId}/items`,
        customer: customer && customer.href,
        address: address && address.href,
        card: card && card.href,
      };
      await axios.post(endpoints.ordersUrl + '/orders', order)
        .then(({data, status}) => res.status(status).json(data));

    } catch (e) {
      next(e);
    }

  });

  module.exports = app;
}());
