美麗華v5。原版位置和玩法維持，商場/輪框/座艙全部重製。
GLB body地面原點、rotor輪心原點、gondola吊點原點。座艙底部為負Y是預期，不可擅自recenter。
套用runtime-anchors.json，整組外層才套0.62/+5。可直接由blend確認組裝。
原碼摩天輪靜態，不擅加轉動。若接已有動畫，輪框與座艙仍可分離。
座艙使用Vertex Color合為1primitive，Three必須保留geometry.color及vertexColors，不可全覆蓋為單色材質。
唯一檔4932tris；18座艙實例後7448tris。建議InstancedMesh，未測遊戲FPS。
原badge:mall的Canvas標誌要保留，GLB只含空白面。
