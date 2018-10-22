
const objectLength		= require( '../base/object_length.js' );


const unit_equihash	= {
      "version": "1.0",
      "alt": "1",
      "messages": [
        {
          "app": "pow_equihash",
          "payload_location": "inline",
          "payload_hash": "8AHx8iL7XS9I0FHq2SvDWd8NQIrB7XPZ57u2jgzLvIM=",
          "payload": {
            "seed": "ae43c89af46b36acfc6bcd97fc390c831b93908afd1c83c72b20ed37b528025a",
            "difficulty": 0,
            "solution": {
              "hash": "8545fa2bb13e951ec108cb5ef8161e5c576737dd39fe251875ab24340f997e8d",
              "nonce": 107515
            }
          }
        },
        {
          "app": "payment",
          "payload_location": "inline",
          "payload_hash": "UUqabdAIZBbByfnPzakf204tF0I446MRiv4pLg1zWt4=",
          "payload": {
            "outputs": [
              {
                "address": "JKATXQDYSE5TGRRZG6QUJS2GVYLCAPHM",
                "amount": 990905
              }
            ],
            "inputs": [
              {
                "unit": "jYBprbaafX6OdkztpiIDY3eBVrovO/Rh074cHBjgt6Q=",
                "message_index": 0,
                "output_index": 0
              }
            ]
          }
        }
      ],
      "authors": [
        {
          "address": "JKATXQDYSE5TGRRZG6QUJS2GVYLCAPHM",
          "authentifiers": {
            "r": "vJMhC+HsEF4QYMjrIAOiPrI3D8nNClOM/1lx/a0X3X4VqMdwoprNzB1D62MYhlmKOb14+dSi77FDMI4TYZW8PQ=="
          }
        }
      ],
      "round_index": 2,
      "pow_type": 1,
      "parent_units": [
        "8LgD+QWkLAbAXCKGxJWgPdPL+VRcMNjlO5Kmc0LZSbY="
      ],
      "last_ball": "vdfhjTVb+SNwjwXwSOWDfOEKDI7VYX9l9jThZSIPCsI=",
      "last_ball_unit": "9wfIZKhSYbtmkJmnYjdozP+NS/o9DIv8hyO1i5lpXQo=",
      "headers_commission": 300,
      "payload_commission": 113,
      "unit": "mj52vm3I27yfJfuM7EsRxj5wmWPDQy7vF8cDRwKf7hY=",
      "timestamp": 1535938735
    };

    const unit_trustme	= {
        "unit":"xVLnaZU5ZOzJY/xPnUt7gKORVgxsSgIzovL4cZl6QjM=",
        "version":"1.0",
        "alt":"1",
        "last_ball_unit":"Du8vtDympYXDfvCxokp7F+K7lWTlkKwX4pq9QGWRdf8=",
        "last_ball":"Hq3MNEQEJF2sCMS+i2fW7lgKXSuuVvjRX8RGfnYfARg=",
        "round_index":751,
        "pow_type":2,
        "headers_commission":300,
        "payload_commission":224,
        "timestamp":1536807378,
        "parent_units":["PhVk6JWSI5ltFaFmEkde+YxXHt1sugOlVdhWAE6L8oI="],
        "authors":[
            {
                "address":"JNA6YWLKFQG7PFF6F32KTXBUAHRAFSET",
                "authentifiers":
                {
                    "r":"3yegwB0T+N1AswV90xrzCZ63Y0JHYydoQ8zMZdb3GrIc/4Kt0W8ylzkMPvbFJGygzEORaTD1Qvo9RQcbC1tDcQ=="
                }
            }
        ],
        "messages":[
            {
                "app":"data_feed",
                "payload_hash":"GI8VZVDo/YJRiiYSTKUMM2M696NiMY+eOTLYPTLDnPk=",
                "payload_location":"inline",
                "payload":{"timestamp":1536807378250}
            },
            {
                "app":"payment",
                "payload_hash":"rpRajKEkxRBpJgrK2XTUv7ZMhjx61REo1R6nEterD/k=",
                "payload_location":"inline",
                "payload":
                {
                    "inputs":[
                        {
                            "unit":"xuvq2Xy+qwd0uc2IcbyM/qKi1ugCn8bPveOpM8krxA4=",
                            "message_index":1,"output_index":0
                        }
                    ],
                    "outputs":[
                        {
                            "address":"JNA6YWLKFQG7PFF6F32KTXBUAHRAFSET",
                            "amount":47736
                        }
                    ]
                }
            }
        ]
    };

    console.log("unit_equihash:" + objectLength.getTotalPayloadSize(unit_equihash));
    console.log("unit_equihash old:" + objectLength.getTotalPayloadSizeOld(unit_equihash));
    console.log("unit_trustme:" + objectLength.getTotalPayloadSize(unit_trustme));
    console.log("unit_trustme old:" + objectLength.getTotalPayloadSizeOld(unit_trustme));









