function main()
    gg.clearResults() -- Limpa resultados de buscas anteriores
    gg.alert("Bem-vindo ao Script de Teste de Dano, HP e Velocidade!")
    
    local choice = gg.choice("O que você deseja fazer?", {"Buscar/Modificar HP (Lógica 1 HP / Zera)", "Buscar/Modificar Velocidade de Veículo"})

    if choice == nil then
        gg.toast("Operação cancelada.")
        return
    elseif choice == 1 then
        handleHPWithCustomLogic()
    elseif choice == 2 then
        handleSpeed()
    end
end

function handleHPWithCustomLogic()
    gg.clearResults()
    local initial_hp_str = gg.prompt("Digite o HP inicial do NPC/personagem (ex: 100):", "", "number")
    if not initial_hp_str then
        gg.toast("Operação cancelada.")
        return
    end
    local initial_hp = tonumber(initial_hp_str)
    if not initial_hp then
        gg.toast("HP inicial inválido.")
        return
    end

    gg.toast("Iniciando busca inicial por HP: " .. initial_hp)
    gg.searchNumber(initial_hp, gg.TYPE_DWORD)

    local results_count = gg.getResultsCount()
    if results_count == 0 then
        gg.toast("Nenhum resultado encontrado para o HP inicial. Tente novamente com um valor diferente ou tipo de dado.")
        return
    elseif results_count > 1 then
        gg.alert("Múltiplos resultados encontrados. Agora, cause dano ao NPC/personagem no jogo e volte aqui para refinar a busca.")
        
        while results_count > 1 do
            local current_hp_str = gg.prompt("Digite o HP atual do NPC/personagem após a mudança: ", "", "number")
            if not current_hp_str then
                gg.toast("Operação cancelada.")
                return
            end
            local current_hp = tonumber(current_hp_str)
            if not current_hp then
                gg.toast("HP atual inválido.")
                return
            end
            
            gg.toast("Refinando busca para HP: " .. current_hp)
            gg.refineNumber(current_hp, gg.TYPE_DWORD)
            results_count = gg.getResultsCount()
            
            if results_count == 0 then
                gg.toast("Nenhum resultado encontrado após o refinamento. O valor pode ter mudado novamente ou o tipo de dado está incorreto.")
                return
            elseif results_count > 1 then
                gg.alert("Ainda há múltiplos resultados. Cause mais dano e refine novamente. Resultados restantes: " .. results_count)
            end
        end
    end

    if results_count == 1 then
        local found_address = gg.getResults(1)[1].address
        local current_value = gg.getResults(1)[1].value
        gg.alert("Endereço de HP isolado!\nEndereço: " .. found_address .. "\nValor Atual: " .. current_value)
        
        local action_choice = gg.choice("Escolha a ação para o HP:", {"Primeiro Tiro (-1 HP)", "Segundo Tiro (Zerar HP)", "Definir HP Manualmente"})

        if action_choice == 1 then -- Primeiro Tiro (-1 HP)
            local new_hp = current_value - 1
            if new_hp < 0 then new_hp = 0 end -- Garante que o HP não fique negativo
            gg.setValues({{address = found_address, value = new_hp, type = gg.TYPE_DWORD}})
            gg.toast("HP modificado para: " .. new_hp .. " (simulando -1 HP)")
        elseif action_choice == 2 then -- Segundo Tiro (Zerar HP)
            local new_hp = 0
            gg.setValues({{address = found_address, value = new_hp, type = gg.TYPE_DWORD}})
            gg.toast("HP modificado para: " .. new_hp .. " (simulando zerar HP)")
        elseif action_choice == 3 then -- Definir HP Manualmente
            local new_hp_str = gg.prompt("Digite o NOVO HP para definir (ex: 1, 9999):", tostring(current_value), "number")
            if new_hp_str then
                local new_hp = tonumber(new_hp_str)
                if new_hp then
                    gg.setValues({{address = found_address, value = new_hp, type = gg.TYPE_DWORD}})
                    gg.toast("HP modificado para: " .. new_hp)
                else
                    gg.toast("Novo HP inválido.")
                end
            else
                gg.toast("Modificação de HP cancelada.")
            end
        else
            gg.toast("Ação de HP cancelada.")
        end
    else
        gg.toast("Não foi possível isolar um único endereço de HP. Tente o processo novamente.")
    end
end

function handleSpeed()
    gg.clearResults()
    local initial_speed_str = gg.prompt("Digite a velocidade inicial do veículo (ex: 50.0):", "", "number")
    if not initial_speed_str then
        gg.toast("Operação cancelada.")
        return
    end
    local initial_speed = tonumber(initial_speed_str)
    if not initial_speed then
        gg.toast("Velocidade inicial inválida.")
        return
    end

    gg.toast("Iniciando busca inicial por velocidade: " .. initial_speed)
    -- Velocidade é geralmente armazenada como float ou double
    gg.searchNumber(initial_speed, gg.TYPE_FLOAT) -- Tenta com float primeiro

    local results_count = gg.getResultsCount()
    if results_count == 0 then
        gg.toast("Nenhum resultado encontrado para a velocidade inicial. Tente novamente com um valor diferente ou tipo de dado (ex: gg.TYPE_DOUBLE).")
        return
    elseif results_count > 1 then
        gg.alert("Múltiplos resultados encontrados. Agora, mude a velocidade do veículo no jogo (acelere/freie) e volte aqui para refinar a busca.")
        
        while results_count > 1 do
            local current_speed_str = gg.prompt("Digite a velocidade atual do veículo após a mudança: ", "", "number")
            if not current_speed_str then
                gg.toast("Operação cancelada.")
                return
            end
            local current_speed = tonumber(current_speed_str)
            if not current_speed then
                gg.toast("Velocidade atual inválida.")
                return
            end
            
            gg.toast("Refinando busca para velocidade: " .. current_speed)
            gg.refineNumber(current_speed, gg.TYPE_FLOAT)
            results_count = gg.getResultsCount()
            
            if results_count == 0 then
                gg.toast("Nenhum resultado encontrado após o refinamento. O valor pode ter mudado novamente ou o tipo de dado está incorreto.")
                return
            elseif results_count > 1 then
                gg.alert("Ainda há múltiplos resultados. Mude a velocidade novamente e refine. Resultados restantes: " .. results_count)
            end
        end
    end

    if results_count == 1 then
        local found_address = gg.getResults(1)[1].address
        local current_value = gg.getResults(1)[1].value
        gg.alert("Endereço de Velocidade isolado!\nEndereço: " .. found_address .. "\nValor Atual: " .. current_value)
        
        local new_speed_str = gg.prompt("Digite a NOVA velocidade para definir (ex: 100.0, 1.0):", tostring(current_value), "number")
        if new_speed_str then
            local new_speed = tonumber(new_speed_str)
            if new_speed then
                gg.setValues({{address = found_address, value = new_speed, type = gg.TYPE_FLOAT}})
                gg.toast("Velocidade modificada para: " .. new_speed)
            else
                gg.toast("Nova velocidade inválida.")
            end
        else
            gg.toast("Modificação de velocidade cancelada.")
        end
    else
        gg.toast("Não foi possível isolar um único endereço de Velocidade. Tente o processo novamente.")
    end
end

main()

